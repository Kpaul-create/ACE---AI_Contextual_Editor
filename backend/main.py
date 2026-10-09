import os
import json
from typing import TypedDict, Literal, AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_xai import ChatXAI
from langgraph.graph import StateGraph, START, END

app = FastAPI(title="Contextual Editor Agent Runtime")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. State Definition
class EditorState(TypedDict):
    original_text: str
    user_instruction: str
    context_notes: str
    draft: str
    critique: str
    revision_count: int
    final_output: str

# 2. Production LLM Client
llm = None


def get_llm():
    global llm
    if llm is not None:
        return llm

    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if provider in {"", "auto"}:
        if os.getenv("GEMINI_API_KEY"):
            provider = "gemini"
        elif os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY"):
            provider = "grok"

    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured. Set it before running the editor pipeline.")
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.3,
            google_api_key=api_key,
            streaming=True,
            convert_system_message_to_human=True,
        )
        return llm

    if provider in {"grok", "xai"}:
        api_key = os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY")
        if not api_key:
            raise RuntimeError("GROK_API_KEY or XAI_API_KEY is not configured. Set one before running the editor pipeline.")
        llm = ChatXAI(
            model_name="grok-2-latest",
            temperature=0.3,
            xai_api_key=api_key,
            streaming=True,
        )
        return llm

    raise RuntimeError("No supported model API key found. Set GEMINI_API_KEY or GROK_API_KEY/XAI_API_KEY.")


# 3. Node Definitions
async def analyze_context(state: EditorState) -> dict:
    prompt = (
        f"Context & Source Text:\n\"\"\"{state['original_text']}\"\"\"\n\n"
        f"User Modification Objective:\n\"\"\"{state['user_instruction']}\"\"\"\n\n"
        "Analyze tone, intent, target audience, and key constraints. "
        "Output 3-4 bulleted execution directives for rewriting."
    )
    client = get_llm()
    res = await client.ainvoke([
        SystemMessage(content="You are a principal technical editor and contextual planner."),
        HumanMessage(content=prompt)
    ])
    return {"context_notes": str(res.content), "revision_count": 0}

async def generate_draft(state: EditorState) -> dict:
    prompt = (
        f"Source Text:\n\"\"\"{state['original_text']}\"\"\"\n\n"
        f"Directives:\n{state['context_notes']}\n\n"
        f"User Goal: {state['user_instruction']}\n\n"
        "Draft the modified version. Retain all necessary structure while executing the edits."
    )
    client = get_llm()
    res = await client.ainvoke([
        SystemMessage(content="You are a professional copywriter and content engineer."),
        HumanMessage(content=prompt)
    ])
    return {"draft": str(res.content), "final_output": str(res.content)}

async def review_critique(state: EditorState) -> dict:
    prompt = (
        f"Draft Text:\n\"\"\"{state['draft']}\"\"\"\n\n"
        f"Context Directives:\n{state['context_notes']}\n\n"
        f"User Goal: {state['user_instruction']}\n\n"
        "Evaluate adherence to instructions and tone consistency. "
        "End strictly with either 'VERDICT: PASS' or 'VERDICT: REVISE' followed by concrete feedback."
    )
    client = get_llm()
    res = await client.ainvoke([
        SystemMessage(content="You are a strict editorial quality assurance auditor."),
        HumanMessage(content=prompt)
    ])
    return {"critique": str(res.content)}

async def revise_content(state: EditorState) -> dict:
    prompt = (
        f"Current Draft:\n\"\"\"{state['draft']}\"\"\"\n\n"
        f"Audit Feedback:\n\"\"\"{state['critique']}\"\"\"\n\n"
        "Apply the critical corrections and produce the refined text."
    )
    client = get_llm()
    res = await client.ainvoke([
        SystemMessage(content="You are an expert line editor executing targeted revisions."),
        HumanMessage(content=prompt)
    ])
    return {
        "draft": str(res.content),
        "final_output": str(res.content),
        "revision_count": state["revision_count"] + 1
    }

# 4. Conditional Router
def critique_router(state: EditorState) -> Literal["revise_content", "__end__"]:
    critique = state.get("critique", "")
    if "VERDICT: PASS" in critique or state.get("revision_count", 0) >= 2:
        return END
    return "revise_content"

# 5. Compile Graph
builder = StateGraph(EditorState)
builder.add_node("analyze_context", analyze_context)
builder.add_node("generate_draft", generate_draft)
builder.add_node("review_critique", review_critique)
builder.add_node("revise_content", revise_content)

builder.add_edge(START, "analyze_context")
builder.add_edge("analyze_context", "generate_draft")
builder.add_edge("generate_draft", "review_critique")
builder.add_conditional_edges("review_critique", critique_router, {
    "revise_content": "revise_content",
    END: END
})
builder.add_edge("revise_content", "review_critique")

graph = builder.compile()

# 6. Stream Endpoint
class EditRequest(BaseModel):
    text: str
    instruction: str

@app.post("/api/edit-stream")
async def edit_stream(req: EditRequest):
    try:
        get_llm()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def sse_generator() -> AsyncGenerator[str, None]:
        initial_state: EditorState = {
            "original_text": req.text,
            "user_instruction": req.instruction,
            "context_notes": "",
            "draft": "",
            "critique": "",
            "revision_count": 0,
            "final_output": ""
        }

        async for chunk in graph.astream(initial_state, stream_mode="updates"):
            for node_name, updates in chunk.items():
                event_data = {
                    "node": node_name,
                    "payload": updates
                }
                yield f"data: {json.dumps(event_data)}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)