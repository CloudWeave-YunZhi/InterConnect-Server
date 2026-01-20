import os
import json
import base64
from openai import OpenAI
from github import Github

# 初始化客户端
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))
gh = Github(os.getenv("GITHUB_TOKEN"))
repo = gh.get_repo(os.getenv("GITHUB_REPOSITORY"))
event_data = json.loads(os.getenv("EVENT_CONTEXT"))
event_name = os.getenv("EVENT_NAME")

# --- 定义 AI 可调用的工具 ---

def list_directory(path="."):
    """列出指定目录下的文件和文件夹"""
    try:
        items = os.listdir(path)
        return "\n".join(items)
    except Exception as e:
        return str(e)

def read_file(path):
    """读取特定文件的完整内容"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()[:5000] # 限制长度防止 Over-token
    except Exception as e:
        return str(e)

def search_keyword(keyword, path="."):
    """在当前目录及其子目录中搜索关键词"""
    results = []
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.md', '.json', '.rs')):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        if keyword in f.read():
                            results.append(full_path)
                except:
                    continue
    return "\n".join(results[:20])

# --- 准备上下文与角色 ---

def get_context():
    if event_name == "pull_request":
        number = event_data["pull_request"]["number"]
        author = event_data["pull_request"]["user"]["login"]
        title = event_data["pull_request"]["title"]
        body = event_data["pull_request"]["body"]
        return number, f"PR Author: @{author}\nTitle: {title}\nBody: {body}\n(This is a Pull Request)"
    
    number = event_data["issue"]["number"]
    author = event_data["issue"]["user"]["login"]
    title = event_data["issue"]["title"]
    body = event_data["issue"]["body"]
    
    if event_name == "issue_comment":
        actor = event_data["comment"]["user"]["login"]
        cmd = event_data["comment"]["body"]
        return number, f"Issue Author: @{author}\nTriggered by: @{actor}\nCommand: {cmd}\nContext: {title}\n{body}"
    
    return number, f"Issue Author: @{author}\nTitle: {title}\nBody: {body}"

issue_num, user_content = get_context()
issue_obj = repo.get_issue(number=issue_num)
repo_labels = [l.name for l in repo.get_labels()]

# --- 主逻辑 ---

messages = [
    {"role": "system", "content": f"""你是一个高级仓库助手 (@github-actions[bot])。
    你可以通过工具阅读代码、搜索文件并管理 Issue/PR 状态。
    
    可用标签: {repo_labels}
    你的目标: 
    1. 理解用户意图。
    2. 如果需要，使用工具查看项目结构或具体文件。
    3. 给出处理方案，并直接执行（打标签、关闭等）。
    
    输出规范:
    回复开头必须是 JSON 指令: {{"labels": [], "state": "open"|"closed"}}
    然后是你的执行报告。"""},
    {"role": "user", "content": user_content}
]

# 工具定义
tools = [
    {"type": "function", "function": {"name": "list_directory", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "search_keyword", "parameters": {"type": "object", "properties": {"keyword": {"type": "string"}}}}}
]

# AI 决策循环 (允许最多 3 次工具调用)
for _ in range(3):
    response = client.chat.completions.create(
        model=os.getenv("AI_MODEL"),
        messages=messages,
        tools=tools
    )
    msg = response.choices[0].message
    messages.append(msg)
    
    if not msg.tool_calls:
        break
        
    for tool_call in msg.tool_calls:
        func_name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        
        if func_name == "list_directory": result = list_directory(**args)
        elif func_name == "read_file": result = read_file(**args)
        elif func_name == "search_keyword": result = search_keyword(**args)
        
        messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})

# 解析结果并操作 GitHub
final_text = messages[-1].content
json_part = {}
try:
    if final_text.startswith("{"):
        import re
        match = re.search(r'(\{.*?\})', final_text, re.DOTALL)
        if match:
            json_part = json.loads(match.group(1))
            final_text = final_text.replace(match.group(1), "").strip()
except:
    pass

# 执行 GitHub 动作
if json_part.get("labels"):
    issue_obj.add_to_labels(*json_part["labels"])
if json_part.get("state"):
    issue_obj.edit(state=json_part["state"])

issue_obj.create_comment(f"### 🤖 AI Agent Action\n\n{final_text}")
