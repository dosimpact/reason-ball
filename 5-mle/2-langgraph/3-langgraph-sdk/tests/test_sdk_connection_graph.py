import importlib

from graphs import __name__ as graphs_package_name


def test_graph_package_imports():
    assert graphs_package_name == "graphs"


def test_registered_graph_modules_import():
    for module_name in [
        "graphs.01_sdk_connection",
        "graphs.02_basic_chat",
        "graphs.03_graph_execution_timeline",
        "graphs.04_streaming_ui",
        "graphs.05_tool_calling_react",
        "graphs.06_human_in_the_loop_interrupt",
        "graphs.07_checkpoint_state_history",
        "graphs.08_time_travel_replay",
        "graphs.09_conditional_routing",
        "graphs.10_subgraph_nested_execution",
        "graphs.11_parallel_map_reduce",
        "graphs.12_structured_output",
        "graphs.13_rag_qa",
        "graphs.14_plan_and_execute",
        "graphs.15_reflection_evaluator_loop",
        "graphs.16_long_term_memory",
        "graphs.17_configurable_assistant",
        "graphs.18_retry_error_degradation",
        "graphs.19_long_context",
        "graphs.20_observability",
        "graphs.21_intent_feedback_generative_ui",
        "graphs.22_custom_event_renderer",
        "graphs.23_thinking_renderer",
        "graphs.24_chat_citation_renderer",
        "graphs.25_push_ui_message",
        "graphs.26_multimodal_image_input",
        "graphs.27_multimodal_voice_input",
        "graphs.28_multimodal_voice_output",
        "graphs.29_chat_code_editor",
        "graphs.30_chat_document_artifact",
        "graphs.31_chat_plan_board",
        "graphs.32_chat_graph_execution_canvas",
        "graphs.33_chat_ui_preview",
        "graphs.34_chat_data_analysis_canvas",
        "graphs.49_loop_engineering_harness",
    ]:
        module = importlib.import_module(module_name)
        assert module.graph is not None
