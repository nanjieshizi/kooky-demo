// Mock 数据：Agent Creator 对话消息
export const MOCK_CREATOR_MESSAGES = [
  {
    id: 'msg-1',
    role: 'user',
    content: '帮我做一个问诊智能体，能分析症状并给出建议',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: `✅ 问诊智能体已成功创建并通过测试！

## 完成内容：
- 创建了 config/agent_llm_config.json
- 实现了 src/agents/agent.py（LangGraph 主逻辑）
- 编写了 src/prompts/system.txt（系统提示词）
- 添加了 src/tools/consultation.py（问诊工具）
- 生成了测试用例 tests/test_agent.py

## 测试结果：
✓ 所有测试通过
✓ 平均响应时间：1.2s
✓ Token 消耗：平均 2.3K/次

您可以在右侧"预览+运行"中测试 Agent，或在"项目文件"中查看生成的代码。`,
    timestamp: Date.now() - 30000,
  },
]

// Mock 数据：测试对话消息
export const MOCK_TEST_MESSAGES = [
  {
    id: 'test-1',
    role: 'user',
    content: '我最近总是头痛，而且有点发烧，喉咙也疼',
    timestamp: Date.now() - 20000,
  },
  {
    id: 'test-2',
    role: 'assistant',
    content: `根据您描述的症状（头痛、发烧、喉咙疼），这可能是上呼吸道感染的表现。

## 症状分析：
- **头痛**：可能由发烧引起
- **发烧**：提示有炎症反应
- **喉咙疼**：上呼吸道感染的典型症状

## 建议：
1. 多喝水，注意休息
2. 可以服用退烧药（如布洛芬）
3. 如果症状持续超过3天或加重，请及时就医
4. 注意观察体温变化

⚠️ 以上建议仅供参考，不能替代专业医疗诊断。`,
    timestamp: Date.now() - 10000,
  },
]

// Mock 数据：LangGraph 调用树
export const MOCK_TRACE_NODES = [
  {
    id: 'n1',
    name: 'LangGraph',
    duration: '9.0s',
    status: 'done',
    depth: 0,
    input: {
      query: '我最近总是头痛，而且有点发烧，喉咙也疼',
    },
    output: {
      response: '根据您描述的症状...',
      confidence: 0.85,
    },
    children: [
      {
        id: 'n2',
        name: 'model',
        duration: '2.3s',
        status: 'done',
        depth: 1,
        input: {
          messages: [
            { role: 'system', content: '你是一个专业的问诊助手...' },
            { role: 'user', content: '我最近总是头痛，而且有点发烧，喉咙也疼' },
          ],
        },
        output: {
          content: '需要分析症状并调用问诊工具',
          tool_calls: [{ name: 'analyze_symptoms', args:  }],
        },
        children: [],
      },
      {
        id: 'n3',
        name: 'tools',
        duration: '6.5s',
        status: 'done',
        depth: 1,
        input: {},
        output: {},
        children: [
          {
            id: 'n4',
            name: 'analyze_symptoms',
            duration: '0.8s',
            status: 'done',
            depth: 2,
            input: {
              symptoms: ['头痛', '发烧', '喉咙疼'],
            },
            output: {
              diagnosis: '上呼吸道感染',
              confidence: 0.85,
            },
            children: [],
          },
          {
            id: 'n5',
            name: 'generate_advice',
            duration: '1.2s',
            status: 'done',
            depth: 2,
            input: {
              diagnosis: '上呼吸道感染',
            },
            output: {
              advice: ['多喝水', '注意休息', '服用退烧药'],
            },
            children: [],
          },
        ],
      },
      {
        id: 'n6',
        name: 'model (final)',
        duration: '0.2s',
        status: 'done',
        depth: 1,
        input: {
          tool_results: [
            { diagnosis: '上呼吸道感染' },
            { advice: ['多喝水', '注意休息'] },
          ],
        },
        output: {
          content: '根据您描述的症状...',
        },
        children: [],
      },
    ],
  },
]

// Mock 数据：项目文件树
export const MOCK_PROJECT_FILES = [
  {
    id: 'f1',
    name: 'my-agent',
    type: 'folder',
    path: 'my-agent',
    children: [
      {
        id: 'f2',
        name: 'config',
        type: 'folder',
        path: 'my-agent/config',
        children: [
          {
            id: 'f3',
            name: 'agent_llm_config.json',
            type: 'file',
            path: 'my-agent/config/agent_llm_config.json',
            content: `{
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 2000,
  "top_p": 0.9
}`,
          },
        ],
      },
      {
        id: 'f4',
        name: 'src',
        type: 'folder',
        path: 'my-agent/src',
        children: [
          {
            id: 'f5',
            name: 'agents',
            type: 'folder',
            path: 'my-agent/src/agents',
            children: [
              {
                id: 'f6',
                name: 'agent.py',
                type: 'file',
                path: 'my-agent/src/agents/agent.py',
                content: `"""问诊智能体主逻辑"""
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    symptoms: list
    diagnosis: str
    advice: list

def analyze_symptoms(state: AgentState):
    """分析症状"""
    # 从消息中提取症状
    symptoms = extract_symptoms(state["messages"][-1])
    return {"symptoms": symptoms}

def generate_diagnosis(state: AgentState):
    """生成诊断"""
    # 基于症状生成诊断
    diagnosis = "上呼吸道感染"
    return {"diagnosis": diagnosis}

def generate_advice(state: AgentState):
    """生成建议"""
    advice = [
        "多喝水，注意休息",
        "可以服用退烧药",
        "如症状持续请就医"
    ]
    return {"advice": advice}

# 构建 LangGraph
workflow = StateGraph(AgentState)
workflow.add_node("analyze", analyze_symptoms)
workflow.add_node("diagnose", generate_diagnosis)
workflow.add_node("advise", generate_advice)

workflow.set_entry_point("analyze")
workflow.add_edge("analyze", "diagnose")
workflow.add_edge("diagnose", "advise")
workflow.add_edge("advise", END)

app = workflow.compile()`,
              },
            ],
          },
          {
            id: 'f7',
            name: 'prompts',
            type: 'folder',
            path: 'my-agent/src/prompts',
            children: [
              {
                id: 'f8',
                name: 'system.txt',
                type: 'file',
                path: 'my-agent/src/prompts/system.txt',
                content: `你是一个专业的问诊助手，能够：
1. 分析用户描述的症状
2. 给出初步的诊断建议
3. 提供健康建议

注意事项：
- 你的建议仅供参考，不能替代专业医疗诊断
- 如果症状严重，务必建议用户及时就医
- 保持专业、友好的语气`,
              },
            ],
          },
          {
            id: 'f9',
            name: 'tools',
            type: 'folder',
            path: 'my-agent/src/tools',
            children: [
              {
                id: 'f10',
                name: 'consultation.py',
                type: 'file',
                path: 'my-agent/src/tools/consultation.py',
                content: `"""问诊工具"""

def extract_symptoms(message: str) -> list:
    """从消息中提取症状"""
    # 简单的关键词匹配
    symptoms = []
    keywords = ["头痛", "发烧", "咳嗽", "喉咙疼", "流鼻涕"]
    for keyword in keywords:
        if keyword in message:
            symptoms.append(keyword)
    return symptoms

def analyze_symptoms(symptoms: list) -> dict:
    """分析症状并返回诊断"""
    # 简化的诊断逻辑
    if "发烧" in symptoms and "喉咙疼" in symptoms:
        return {
            "diagnosis": "上呼吸道感染",
            "confidence": 0.85
        }
    return {
        "diagnosis": "需要更多信息",
        "confidence": 0.5
    }`,
              },
            ],
          },
        ],
      },
      {
        id: 'f11',
        name: 'runtime',
        type: 'folder',
        path: 'my-agent/runtime',
        children: [
          {
            id: 'f12',
            name: 'inputs',
            type: 'folder',
            path: 'my-agent/runtime/inputs',
            children: [],
          },
          {
            id: 'f13',
            name: 'outputs',
            type: 'folder',
            path: 'my-agent/runtime/outputs',
            children: [],
          },
        ],
      },
      {
        id: 'f14',
        name: 'logs',
        type: 'folder',
        path: 'my-agent/logs',
        children: [
          {
            id: 'f15',
            name: '2026-05-25-10-23.log',
            type: 'file',
            path: 'my-agent/logs/2026-05-25-10-23.log',
            content: `[2026-05-25 10:23:15] INFO: Agent started
[2026-05-25 10:23:15] INFO: Analyzing symptoms...
[2026-05-25 10:23:16] INFO: Diagnosis: 上呼吸道感染
[2026-05-25 10:23:17] INFO: Generating advice...
[2026-05-25 10:23:18] INFO: Agent completed (duration: 3.2s)`,
          },
        ],
      },
      {
        id: 'f16',
        name: 'tests',
        type: 'folder',
        path: 'my-agent/tests',
        children: [
          {
            id: 'f17',
            name: 'test_agent.py',
            type: 'file',
            path: 'my-agent/tests/test_agent.py',
            content: `"""测试用例"""
import pytest
from src.agents.agent import app

def test_basic_consultation():
    """测试基本问诊功能"""
    result = app.invoke({
        "messages": ["我头痛发烧"],
        "symptoms": [],
        "diagnosis": "",
        "advice": []
    })
    assert result["diagnosis"] != ""
    assert len(result["advice"]) > 0

def test_symptom_extraction():
    """测试症状提取"""
    from src.tools.consultation import extract_symptoms
    symptoms = extract_symptoms("我头痛发烧喉咙疼")
    assert "头痛" in symptoms
    assert "发烧" in symptoms`,
          },
        ],
      },
      {
        id: 'f18',
        name: 'README.md',
        type: 'file',
        path: 'my-agent/README.md',
        content: `# 问诊智能体

基于 LangGraph 的问诊助手，能够分析症状并给出健康建议。

## 功能
- 症状分析
- 初步诊断
- 健康建议

## 使用方法
\`\`\`python
from src.agents.agent import app

result = app.invoke({
    "messages": ["我头痛发烧"],
    "symptoms": [],
    "diagnosis": "",
    "advice": []
})
\`\`\``,
      },
    ],
  },
]
