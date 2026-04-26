#!/usr/bin/env python3
"""直接调用腾讯云API创建函数URL（带V3签名）"""

import hashlib
import hmac
import json
import datetime
import os

SECRET_ID = os.environ.get("TENCENT_SECRET_ID", "")
SECRET_KEY = os.environ.get("TENCENT_SECRET_KEY", "")
REGION = "ap-guangzhou"
SERVICE = "scf"
HOST = "scf.tencentcloudapi.com"


def sha256_hash(data):
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hmac_sha256(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def sign(secret_key, date, service, string_to_sign):
    date_key = hmac_sha256(("TC3" + secret_key).encode("utf-8"), date)
    service_key = hmac_sha256(date_key, service)
    credentials_key = hmac_sha256(service_key, "tc3_request")
    signature = hmac.new(credentials_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return signature


def tencentcloud_request(action, payload):
    timestamp = int(datetime.datetime.utcnow().timestamp())
    date = datetime.datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")

    # 规范请求
    http_method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    content_type = "application/json; charset=utf-8"
    payload_json = json.dumps(payload)
    payload_hash = sha256_hash(payload_json)

    canonical_headers = f"content-type:{content_type}\nhost:{HOST}\nx-tc-action:{action.lower()}\n"
    signed_headers = "content-type;host;x-tc-action"
    canonical_request = f"{http_method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    # 待签名字符串
    algorithm = "TC3-HMAC-SHA256"
    credential_scope = f"{date}/{SERVICE}/tc3_request"
    canonical_request_hash = sha256_hash(canonical_request)
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{canonical_request_hash}"

    # 计算签名
    signature = sign(SECRET_KEY, date, SERVICE, string_to_sign)

    # 构造Authorization
    authorization = f"{algorithm} Credential={SECRET_ID}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"

    headers = {
        "Authorization": authorization,
        "Content-Type": content_type,
        "Host": HOST,
        "X-TC-Action": action,
        "X-TC-Version": "2018-04-16",
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Region": REGION,
    }

    resp = requests.post(f"https://{HOST}", headers=headers, data=payload_json)
    return resp.json()


def main():
    print("创建函数URL...")
    result = tencentcloud_request("CreateFunctionUrlConfig", {
        "FunctionName": "kimi-proxy",
        "AuthType": "NONE"
    })
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result.get("Response", {}).get("Url"):
        url = result["Response"]["Url"]
        print(f"\n✅ 函数URL创建成功！")
        print(f"🔗 URL: {url}")

        # 配置CORS
        print("\n配置CORS...")
        cors_result = tencentcloud_request("UpdateFunctionUrlConfig", {
            "FunctionName": "kimi-proxy",
            "Cors": {
                "AccessControlAllowOrigins": ["*"],
                "AccessControlAllowMethods": ["POST", "OPTIONS"],
                "AccessControlAllowHeaders": ["Content-Type", "Authorization"],
                "AccessControlMaxAge": 86400
            }
        })
        print(json.dumps(cors_result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
