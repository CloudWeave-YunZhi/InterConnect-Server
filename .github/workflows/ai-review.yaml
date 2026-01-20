import os
import json
import re
from openai import OpenAI
from github import Github, Auth

# 初始化客户端
auth = Auth.Token(os.getenv("GITHUB_TOKEN"))
gh = Github(auth=auth)
repo = gh.get_repo(os.getenv("GITHUB_REPOSITORY"))
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))

event_data = json.loads(os.getenv("EVENT_CONTEXT"))
event_name = os.getenv("EVENT_NAME")

# --- 工具定义 (保持不变，增加 **kwargs 鲁棒性) ---
def list_directory(path=".", **kwargs):
    try:
        if ".." in path: return "Error: Access denied."
        return "\n".join(os.listdir(path))
    except Exception as e: return str(e)

def read_file(path, **kwargs):
    try:
        if ".." in path: return "Error: Access denied."
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()[:5000]
    except Exception as e: return str(e)

def search_keyword(keyword, path=".", **kwargs):
    results = []
    for root, _, files in os.walk(path):
        if ".git" in root: continue
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.md', '.json', '.rs', '.yml')):
                p = os.path.join(root, file)
                try:
                    if keyword in open(p, 'r').read(): results.append(p)
                except: continue
    return "\n".join(results[:15]) if results else "No matches."

# --- 上下文准备 ---
def get_context():
    if "pull_request" in event_data:
        p = event_data["pull_request"]
        return p["number"], f"PR @{p['user']['login']}\nTitle: {p['title']}\n{p['body']}"
    
    i = event_data["issue"]
    ctx = f"Issue @{i['user']['login']}\nTitle: {i['title']}\n{i['body']}"
    if event_name == "issue_comment":
        ctx += f"\n\nNew Comment by @{event_data['comment']['user']['login']}: {event_data['comment']['body']}"
    return i["number"], ctx

issue_num, user_content = get_context()
issue_obj = repo.get_issue(number=issue_num)
repo_labels = [l.name for l in repo.get_labels()]

# --- AI 执行逻辑 ---
messages = [
    {"role": "system", "content": f"你是一个高级仓库助手。可用标签: {repo_labels}。必须首行返回JSON: {{\"labels\":[], \"state\":\"open\"}}，然后解释逻辑。"},
    {"role": "user", "content": user_content}
]

tools = [
    {"type": "function", "function": {"name": "list_directory", "description": "List files", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "description": "Read content", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "search_keyword", "description": "Search keyword", "parameters": {"type": "object", "properties": {"keyword": {"type": "string"}}}}}
]

# 允许最多 5 轮工具交互
for i in range(5):
    response = client.chat.completions.create(
        model=os.getenv("AI_MODEL"),
        messages=messages,
        tools=tools,
        temperature=0
    )
    
    # 核心修复：统一将模型返回的消息转为可序列化的字典格式
    msg = response.choices[0].message
    msg_dict = msg.model_dump()
    messages.append(msg_dict)
    
    if not msg.tool_calls:
        break
        
    for tool_call in msg.tool_calls:
        args = json.loads(tool_call.function.arguments)
        func = {"list_directory": list_directory, "read_file": read_file, "search_keyword": search_keyword}.get(tool_call.function.name)
        result = func(**args) if func else "Unknown function"
        messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": str(result)})

# 确保最后一条消息是文本回复
if messages[-1].get("role") == "tool" or (messages[-1].get("tool_calls") and not messages[-1].get("content")):
    final_check = client.chat.completions.create(model=os.getenv("AI_MODEL"), messages=messages)
    messages.append(final_check.choices[0].message.model_dump())

# 提取最终文本内容
final_msg = messages[-1]
final_res = final_msg.get("content") or ""

# --- 结果解析与执行 ---
json_data = {"labels": [], "state": "open"}
match = re.search(r'(\{.*?\})', final_res, re.DOTALL)
if match:
    try:
        json_data = json.loads(match.group(1))
        final_res = final_res.replace(match.group(1), "").strip()
    except: pass

if json_data.get("labels"):
    issue_obj.add_to_labels(*json_data["labels"])
if json_data.get("state") in ["open", "closed"]:
    issue_obj.edit(state=json_data["state"])

issue_obj.create_comment(f"### 🤖 AI Agent Execution\n\n{final_res}")
