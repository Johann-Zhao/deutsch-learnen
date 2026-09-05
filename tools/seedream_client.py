# -*- coding: utf-8 -*-
"""Seedream（火山引擎 Ark）生图客户端。

API 配置读取项目根 .env（SEEDREAM_API_KEY / SEEDREAM_API_BASE / SEEDREAM_MODEL），
统一使用 python-dotenv 加载；尺寸回退 + 重试 + PNG 校验。
"""
import base64
import pathlib
import time

import httpx
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

NO_TEXT_SUFFIX = "，扁平矢量插画风格，柔和明亮的配色，简洁现代，无文字，无水印，无logo"


def _getenv(key, default=""):
    import os
    return os.getenv(key, default)


API_KEY = _getenv("SEEDREAM_API_KEY", "")
API_BASE = _getenv("SEEDREAM_API_BASE", "https://ark.cn-beijing.volces.com/api/v3")
MODEL = _getenv("SEEDREAM_MODEL", "doubao-seedream-5-0-pro-260628")


def generate(prompt, out_path, sizes=("1024x1024",), max_retry=3, verbose=True, suffix=NO_TEXT_SUFFIX):
    """生成一张图并落盘，返回 (ok, out_path|None, note)。suffix=None/'' 时不追加默认后缀。"""
    out_path = pathlib.Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body_prompt = prompt + (suffix or '')

    for attempt in range(1, max_retry + 1):
        for size in sizes:
            try:
                with httpx.Client(timeout=120, trust_env=False) as client:
                    resp = client.post(
                        f"{API_BASE}/images/generations",
                        headers={
                            "Authorization": f"Bearer {API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": MODEL,
                            "prompt": body_prompt,
                            "size": size,
                            "response_format": "b64_json",
                            "watermark": False,
                            "output_format": "png",
                        },
                    )
                if resp.status_code != 200:
                    if verbose:
                        print(f"  HTTP {resp.status_code} @{size}: {resp.text[:120]}")
                    continue
                payload = resp.json()
                data = payload["data"][0]
                if data.get("b64_json"):
                    raw = base64.b64decode(data["b64_json"])
                elif data.get("url"):
                    with httpx.Client(timeout=60, trust_env=False) as client:
                        raw = client.get(data["url"]).content
                else:
                    continue
                # PNG magic + 大小校验，防空白图
                if not raw.startswith(b"\x89PNG") or len(raw) < 30 * 1024:
                    if verbose:
                        print(f"  疑似空白图（{len(raw)}B），重试")
                    continue
                out_path.write_bytes(raw)
                return True, str(out_path), f"ok@{size}"
            except Exception as e:
                if verbose:
                    print(f"  尝试 {attempt} @{size} 失败: {e}")
                time.sleep(2)
        time.sleep(1)
    return False, None, "failed"


if __name__ == "__main__":
    import sys
    ok, path, note = generate(sys.argv[1] if len(sys.argv) > 1 else "一只橘猫在读书",
                              sys.argv[2] if len(sys.argv) > 2 else "test.png")
    print(ok, path, note)
