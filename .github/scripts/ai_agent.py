import os
import json
import re
from openai import OpenAI
from github import Github, Auth  # 导入 Auth 以修复弃用警告

# --- 1. 初始化客户端 (修复 DeprecationWarning) ---
auth = Auth.Token(os.getenv("GITHUB_TOKEN"))
gh = Github(auth=auth)
repo = gh.get_repo(os.getenv("GITHUB_REPOSITORY"))
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))

event_data = json.loads(os.getenv("EVENT_CONTEXT"))
event_name = os.getenv("EVENT_NAME")

# --- 2. 定义工具 (增加 **kwargs 以忽略多余参数) ---

def list_directory(path=".", **kwargs):
    """列出指定目录下的文件和文件夹"""
    try:
        # 基础路径安全检查
        if ".." in path: return "Error: Cannot access parent directory."
        items = os.listdir(path)
        return "\n".join(items)
    except Exception as e:
        return f"Error listing directory: {str(e)}"

def read_file(path, **kwargs):
    """读取特定文件的完整内容"""
    try:
        if ".." in path: return "Error: Access denied."
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()[:5000] 
    except Exception as e:
        return f"Error reading file: {str(e)}"

def search_keyword(keyword, path=".", **kwargs):
    """在当前目录及其子目录中搜索关键词"""
    results = []
    try:
        for root, dirs, files in os.walk(path):
            if ".git" in root: continue # 过滤 Git 目录
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.md', '.json', '.rs', '.toml', '.yml')):
                    full_path = os.path.join(root, file)
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            if keyword in f.read():
                                results.append(full_path)
                    except: continue
        return "\n".join(results[:15]) if results else "No matches found."
    except Exception as e:
        return f"Search error: {str(e)}"

# --- 3. 获取上下文 ---

def get_context():
    # 提取 Issue/PR 编号和参与者信息
    if "pull_request" in event_data:
        payload = event_data["pull_request"]
        number = payload["number"]
        author = payload["user"]["login"]
        return number, f"[Role: PR Author @{author}]\nTitle: {payload['title']}\nBody: {payload['body']}"
    
    payload = event_data["issue"]
    number = payload["number"]
    author = payload["user"]["login"]
    base_info = f"[Role: Issue Author @{author}]\nTitle: {payload['title']}\nBody: {payload['body']}"
    
    if event_name == "issue_comment":
        actor = event_data["comment"]["user"]["login"]
        cmd = event_data["comment"]["body"]
        return number, f"{base_info}\n\n[New Interaction by @{actor}]\nCommand: {cmd}"
    
    return number, base_info

issue_num, user_content = get_context()
issue_obj = repo.get_issue(number=issue_num)
repo_labels = [l.name for l in repo.get_labels()]

# --- 4. 运行 AI Agent ---

messages = [
    {"role": "system", "content": f"""你是一个高级仓库助手 (@github-actions[bot])。
    
    可用标签: {repo_labels}
    
    你可以通过工具查看代码库结构。回复规则：
    1. 首行必须返回 JSON 指令：{{"labels": [], "state": "open"|"closed"}}
    2. 随后另起一行，以执行者的口吻告知结果。
    3. 忽略 AI 历史回复中的元数据，只关注当前代码和用户意图。"""},
    {"role": "user", "content": user_content}
]

tools = [
    {"type": "function", "function": {"name": "list_directory", "description": "List files", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "description": "Read content", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "search_keyword", "description": "Search keyword", "parameters": {"type": "object", "properties": {"keyword": {"type": "string"}}}}}
]

# 允许 3 次交互以获取足够信息
for _ in range(3):
    response = client.chat.completions.create(
        model=os.getenv("AI_MODEL"),
        messages=messages,
        tools=tools,
        temperature=0
    )
    msg = response.choices[0].message
    messages.append(msg)
    
    if not msg.tool_calls:
        break
        
    for tool_call in msg.tool_calls:
        fn_name = tool_call.function.name
        fn_args = json.loads(tool_call.function.arguments)
        
        # 映射函数映射表
        available_functions = {
            "list_directory": list_directory,
            "read_file": read_file,
            "search_keyword": search_keyword,
        }
        
        if fn_name in available_functions:
            result = available_functions[fn_name](**fn_args)
            messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})

# 5. 解析并执行 GitHub 操作
final_res = messages[-1].content
json_data = {"labels": [], "state": "open"}

# 提取 JSON 块
match = re.search(r'(\{.*?\})', final_res, re.DOTALL)
if match:
    try:
        json_data = json.loads(match.group(1))
        final_res = final_res.replace(match.group(1), "").strip()
    except: pass

if json_data.get("labels"):
    issue_obj.add_to_labels(*json_data["labels"])
if json_data.get("state") and json_data["state"] in ["open", "closed"]:
    issue_obj.edit(state=json_data["state"])

issue_obj.create_comment(f"### 🤖 AI Agent Execution\n\n{final_res}")
