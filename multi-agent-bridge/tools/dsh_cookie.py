#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 DSH web (3080) 的合法认证 cookie，用于外部实时访问其 gateway RPC。
原理：DSH 用 HMAC-SHA256 签名 cookie，secret 存于 ~/.dsh/.credentials.yaml 的
client-connection/browser-session。cookie 名绑定 authority(host头)，值含
version/authority/issuedAt/expiresAt + HMAC 签名。

用法：
  python dsh_cookie.py                     # 打印 cookie 名=值
  python dsh_cookie.py --authority 127.0.0.1:3080
"""
import os, sys, json, base64, hashlib, hmac, time, argparse, re

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def unb64url(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)

def load_secret():
    """从 .credentials.yaml 读 client-connection/browser-session 的 secret"""
    p = os.path.join(os.path.expanduser("~"), ".dsh", ".credentials.yaml")
    with open(p, "r", encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"secret:\s*(\S+)", txt)
    if not m:
        raise RuntimeError("未找到 secret")
    return m.group(1).strip()

def make_cookie(authority, secret, max_age_days=30):
    # secret 是 base64url 编码的 32 字节
    secret_bytes = unb64url(secret)
    # cookie 名 = dsh-auth- + base64url(sha256(authority))
    name = "dsh-auth-" + b64url(hashlib.sha256(authority.encode()).digest())
    # payload
    now = int(time.time() * 1000)
    expires = now + max_age_days * 86400 * 1000
    payload = {"version": 1, "authority": authority, "issuedAt": now, "expiresAt": expires}
    body = b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = b64url(hmac.new(secret_bytes, body.encode(), hashlib.sha256).digest())
    value = f"v1.{body}.{sig}"
    return name, value, payload

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--authority", default="127.0.0.1:3080")
    ap.add_argument("--secret", default=None)
    args = ap.parse_args()
    secret = args.secret or load_secret()
    name, value, payload = make_cookie(args.authority, secret)
    print(f"{name}={value}")
    print(f"# authority={args.authority}  expiresIn={payload['expiresAt']-payload['issuedAt']}ms", file=sys.stderr)

if __name__ == "__main__":
    main()
