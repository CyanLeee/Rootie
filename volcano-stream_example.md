# volcano engine API流式输出示例
## request
import os

from volcenginesdkarkruntime import Ark

client = Ark(api_key=os.environ.get("ARK_API_KEY"))

if __name__ == "__main__":
    resp = client.chat.completions.create(
        model="doubao-1-5-pro-32k-250115",
        messages=[{"content":"You are a helpful assistant.","role":"system"},{"content":"hello","role":"user"}],
        stream=True,
    )
    for chunk in resp:
        if not chunk.choices:
            continue

        print(chunk.choices[0].delta.content, end="")


## response
{"choices":[{"delta":{"content":"Hello","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":"!","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" How","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" can","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" I","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" help","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" you","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":" today","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":"?","role":"assistant"},"index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

{"choices":[{"delta":{"content":"","role":"assistant"},"finish_reason":"stop","index":0}],"created":1742632436,"id":"021742632435712396f12d018b5d576a7a55349c2eba0815061fc","model":"doubao-1-5-pro-32k-250115","service_tier":"default","object":"chat.completion.chunk","usage":null}

[DONE]