#!/usr/bin/env python3
"""腾讯云 SCF + API 网关自动化部署脚本"""

import base64
import json
import time
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.scf.v20180416 import scf_client, models as scf_models
from tencentcloud.apigateway.v20180808 import apigateway_client, models as apigw_models

# 配置
SECRET_ID = os.environ.get("TENCENT_SECRET_ID", "")
SECRET_KEY = os.environ.get("TENCENT_SECRET_KEY", "")
REGION = "ap-guangzhou"
FUNCTION_NAME = "kimi-proxy"
ZIP_FILE = "/tmp/kimi-proxy.zip.b64"

def get_code():
    with open(ZIP_FILE, 'r') as f:
        return f.read().strip()

def create_function(cred):
    http_profile = HttpProfile()
    http_profile.endpoint = "scf.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = scf_client.ScfClient(cred, REGION, client_profile)

    req = scf_models.CreateFunctionRequest()
    req.FunctionName = FUNCTION_NAME
    req.Runtime = "Nodejs18.15"
    req.Handler = "index.main_handler"
    req.MemorySize = 512
    req.Timeout = 60
    req.Description = "拍照出题助手 - MiniMax多模态"
    req.Role = "SCFExecuteRole"
    req.AsyncRunEnable = "FALSE"
    req.TraceEnable = "FALSE"

    # 代码
    code = scf_models.Code()
    code.ZipFile = get_code()
    req.Code = code

    # 环境变量
    env = scf_models.Environment()
    v1 = scf_models.Variable()
    v1.Key = "KIMI_API_KEY"
    v1.Value = os.environ.get("KIMI_API_KEY", "")
    v2 = scf_models.Variable()
    v2.Key = "KIMI_MODEL"
    v2.Value = "kimi-for-coding"
    env.Variables = [v1, v2]
    req.Environment = env

    try:
        resp = client.CreateFunction(req)
        print(f"✅ 函数创建成功: {resp.RequestId}")
        return True
    except TencentCloudSDKException as e:
        if "ResourceInUse" in str(e) or "already exists" in str(e).lower():
            print("⚠️ 函数已存在，尝试更新代码...")
            return update_function(cred)
        print(f"❌ 创建函数失败: {e}")
        return False

def update_function(cred):
    http_profile = HttpProfile()
    http_profile.endpoint = "scf.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = scf_client.ScfClient(cred, REGION, client_profile)

    # 更新代码
    req = scf_models.UpdateFunctionCodeRequest()
    req.FunctionName = FUNCTION_NAME
    req.Handler = "index.main_handler"
    code = scf_models.Code()
    code.ZipFile = get_code()
    req.Code = code

    try:
        resp = client.UpdateFunctionCode(req)
        print(f"✅ 代码更新成功: {resp.RequestId}")
    except TencentCloudSDKException as e:
        print(f"❌ 更新代码失败: {e}")
        return False

    # 同时更新环境变量（确保和代码一致）
    req2 = scf_models.UpdateFunctionConfigurationRequest()
    req2.FunctionName = FUNCTION_NAME
    env = scf_models.Environment()
    v1 = scf_models.Variable(); v1.Key = "KIMI_API_KEY"; v1.Value = os.environ.get("KIMI_API_KEY", "")
    v2 = scf_models.Variable(); v2.Key = "KIMI_MODEL"; v2.Value = "kimi-for-coding"
    env.Variables = [v1, v2]
    req2.Environment = env

    try:
        resp2 = client.UpdateFunctionConfiguration(req2)
        print(f"✅ 环境变量更新成功: {resp2.RequestId}")
    except TencentCloudSDKException as e:
        print(f"⚠️ 环境变量更新失败（可能不影响）: {e}")

    return True

def create_trigger(cred):
    http_profile = HttpProfile()
    http_profile.endpoint = "scf.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = scf_client.ScfClient(cred, REGION, client_profile)

    req = scf_models.CreateTriggerRequest()
    req.FunctionName = FUNCTION_NAME
    req.TriggerName = "kimi-proxy-apigw"
    req.Type = "apigw"
    req.TriggerDesc = json.dumps({
        "api": {
            "authRequired": "FALSE",
            "requestConfig": {"method": "POST"},
            "isIntegratedResponse": "FALSE",
            "isSupportCORS": "TRUE"
        },
        "service": {
            "serviceName": "kimi-proxy-service"
        },
        "release": {
            "environmentName": "release"
        }
    })

    try:
        resp = client.CreateTrigger(req)
        print(f"✅ 触发器创建成功: {resp.RequestId}")
        # 提取API网关URL
        if resp.TriggerInfo:
            print(f"\n🔗 API 网关地址: {resp.TriggerInfo.TriggerDesc}")
        return True
    except TencentCloudSDKException as e:
        if "already exists" in str(e).lower() or "ResourceInUse" in str(e):
            print("⚠️ 触发器已存在")
            return True
        print(f"❌ 创建触发器失败: {e}")
        return False

def get_function_url(cred):
    http_profile = HttpProfile()
    http_profile.endpoint = "scf.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = scf_client.ScfClient(cred, REGION, client_profile)

    req = scf_models.GetFunctionRequest()
    req.FunctionName = FUNCTION_NAME

    try:
        resp = client.GetFunction(req)
        for trigger in resp.Triggers:
            if trigger.Type == "apigw":
                try:
                    desc = json.loads(trigger.TriggerDesc)
                    api_id = desc.get("api", {}).get("apiId")
                    service_id = desc.get("service", {}).get("serviceId")
                    if api_id and service_id:
                        url = f"https://service-{service_id}-{REGION}.apigw.tencentcs.com/release{desc['api'].get('path', '/kimi-proxy')}"
                        return url
                except:
                    pass
    except:
        pass
    return None

def main():
    print("========================================")
    print("  📸 拍照出题助手 - 腾讯云自动化部署")
    print("========================================\n")

    cred = credential.Credential(SECRET_ID, SECRET_KEY)

    # 步骤1：创建/更新函数
    if not create_function(cred):
        print("\n部署失败，请检查权限和配置。")
        return

    # 等待函数创建完成
    print("\n⏳ 等待函数状态就绪...")
    time.sleep(5)

    # 步骤2：创建API网关触发器
    print("\n🚀 创建 API 网关触发器...")
    create_trigger(cred)

    # 步骤3：获取URL
    print("\n🔍 获取访问地址...")
    time.sleep(3)
    url = get_function_url(cred)

    print("\n========================================")
    print("  ✅ 部署完成！")
    print("========================================")
    if url:
        print(f"\n🔗 API 网关地址: {url}")
        print(f"\n请将此地址填入 miniprogram/config.js 的 API_BASE_URL")
    else:
        print("\n请去腾讯云控制台「触发管理」中查看 API 网关地址")

if __name__ == "__main__":
    main()
