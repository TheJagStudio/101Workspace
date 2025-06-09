import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from django.db.models import Sum, Count, Avg, Max, Min
from api.models import Product, Category, BusinessType, InventoryData, Vendor, Invoice, InvoiceLineItem
from tracker.models import DailyActivity, Salesman, LocationPoint, AdminSettings
from django.db import connection, transaction
from datetime import datetime, date
import django  # <-- Add this import
import sys
import io
import json

# Load environment variables first
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Example of a tool description that guides the LLM
TOOL_DESCRIPTION = """
Use this tool to execute Django ORM queries against the database.
The input to this tool must be valid Python code that imports necessary models from `api.models`
and executes a Django ORM query, returning the result as a list of dictionaries or a single dictionary/value.
Example usage:
```python
from api.models import Product
results = list(Product.objects.filter(active=True).values('productName', 'availableQuantity'))
```
The output of this tool will be the result of the executed query or an error message.


"""


def ExecuteOrmQuery(python_code: str) -> str:
    if not python_code.strip():
        print("Error: Empty Python code provided for execution.")
        return "Error: Empty Python code provided for execution."
    # forbidden_keywords = [
    #     "os.", "subprocess", "eval(", "exec(", "import ", "open(", "shutil",
    #     "sys.", "requests", "urllib", "socket", "pickle", "config", "settings"
    # ]
    forbidden_keywords = []
    if any(keyword in python_code for keyword in forbidden_keywords):
        print("Error: The generated code contains forbidden keywords. Only Django ORM operations are allowed.")
        return "Error: The generated code contains forbidden keywords. Only Django ORM operations are allowed."
    if "DROP TABLE" in python_code.upper() or "DELETE FROM" in python_code.upper():
        print("Error: Detected potential malicious database operation. Operation blocked.")
        return "Error: Detected potential malicious database operation. Operation blocked."
    safe_globals = {
        "Product": Product,
        "Category": Category,
        "BusinessType": BusinessType,
        "InventoryData": InventoryData,
        "Vendor": Vendor,
        "Invoice": Invoice,
        "InvoiceLineItem": InvoiceLineItem,
        "Salesman": Salesman,
        "LocationPoint": LocationPoint,
        "DailyActivity": DailyActivity,
        "AdminSettings": AdminSettings,
        "Sum": Sum,
        "Count": Count,
        "Avg": Avg,
        "Max": Max,
        "Min": Min,
        "datetime": datetime,
        "date": date,
        "list": list,
    }
    _locals = {}
    try:
        old_stdout = sys.stdout
        sys.stdout = mystdout = io.StringIO()
        try:
            exec(python_code, safe_globals, _locals)
        finally:
            sys.stdout = old_stdout
        cli_output = mystdout.getvalue()
        if "results" in _locals:
            results = _locals["results"]
            if hasattr(results, "values") and callable(results.values):
                results = list(results.values())
            elif isinstance(results, django.db.models.query.QuerySet):
                results = list(results.values())
            elif not isinstance(results, (list, dict, str, int, float, bool, type(None))):
                results = str(results)
            try:
                return json.dumps(results, indent=2, default=str)
            except TypeError:
                print(f"Error serializing results to JSON: {results}")
                return f"Error: Could not serialize results to JSON. Raw: {results}"
        else:
            print("Error: The executed code did not produce a 'results' variable.")
            return "Error: The executed code did not produce a 'results' variable. CLI Output: " + cli_output.strip()
    except Exception as e:
        if isinstance(e, django.core.exceptions.FieldDoesNotExist):
            print(f"Django ORM Error: Field does not exist. Check model schema. Details: {e}")
            return f"Django ORM Error: Field does not exist. Check model schema. Details: {e}"
        elif isinstance(e, django.db.utils.ProgrammingError):
            print(f"Database Programming Error: {e}. This might be due to an incorrect query structure or column name.")
            return f"Database Programming Error: {e}. This might be due to an incorrect query structure or column name."
        elif isinstance(e, django.db.models.ObjectDoesNotExist):
            print(f"Django ORM Error: Object does not exist. No matching record found. Details: {e}")
            return f"Django ORM Error: Object does not exist. No matching record found. Details: {e}"
        else:
            print(f"Error executing Django ORM query: {type(e).__name__} - {e}")
            return f"Error executing Django ORM query: {type(e).__name__} - {e}"


class DjangoAIAgent:

    def __init__(self, model_name="gemini-2.0-flash-lite", temperature=0.1):
        # self.model_name = model_name
        self.model_name = "gemini-2.5-flash-preview-04-17"
        # self.model_name = "gemini-2.5-flash-preview-05-20"
        self.temperature = temperature
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.cache = None

    def query_database(self, natural_language_query: str, chat_history: list = None) -> str:
        """
        Processes a natural language query and uses the Gemini AI agent to interact with the database.
        """
        if chat_history is None:
            chat_history = []

        # Read system prompt from file (if needed)
        with open("./api/ai_agent/modelContext.txt", "r") as file:
            final_system_prompt = file.read().strip()
        SYSTEM_PROMPT = (
            """
You are an AI assistant designed to interact with a Django database.
Your primary function is to translate natural language queries into executable Django ORM code.
You have access to the following Django models and their schema:

"""
            + final_system_prompt
            + """

When a user asks a question, follow these steps:
1.  **Analyze the user's request:** Understand the intent, desired data, and any filtering/aggregation requirements.
2.  **Determine the relevant Django models and fields:** Use the provided schema context to identify which models and fields are needed.
3.  **Construct a Django ORM query:** Write Python code that uses Django's ORM to retrieve the requested data.
    * **Prioritize Django ORM:** Always try to use the ORM for safety and clarity.
    * **Relationships:** If multiple models are involved, use Django's related field lookups (e.g., `product__productName`).
    * **Aggregations:** Use `annotate` and `aggregate` for `SUM`, `COUNT`, `AVG`, `MAX`, `MIN`.
    * **Filtering:** Use `filter()` with appropriate lookups (e.g., `__icontains`, `__gte`, `__lte`, `__startswith`, `__endswith`).
    * **Ordering:** Use `order_by()`.
    * **Select specific fields:** Use `values()` or `values_list()` for efficiency if only a few fields are needed.
    * **Limit results:** Always include `.first()`, `[:N]`, or `[offset:limit]` for pagination or single results, unless the user explicitly asks for all.
    * **Security:** DO NOT use raw SQL unless absolutely necessary and ensure all inputs are parameterized.
    * **Error Handling:** Include basic try-except blocks for robust execution.
4.  **Execute the ORM query using the 'run_django_orm_query' tool.**
5.  **Interpret the results:** Understand the data returned by the ORM query.
6.  **Formulate a concise and clear natural language response:** Present the answer to the user in an easy-to-understand format. If the results are extensive, summarize them or state how many records were found.

If the query is ambiguous or requires more information, ask clarifying questions.
If you cannot fulfill the request with the available models, state that clearly.
If the request is not related to database queries, inform the user you are a database interaction agent.

Example ORM snippets for common operations:
- `Product.objects.filter(productName__icontains='laptop').values('productName', 'standardPrice')`
- `Invoice.objects.filter(status='completed').count()`
- `InvoiceLineItem.objects.values('product__productName').annotate(total_sold=Sum('quantity')).order_by('-total_sold')[:5]`
- `Salesman.objects.get(user__username='JohnDoe')`

Do not hallucinate model names, field names, or data. Only use information provided in the schema context.

Your final response after processing the user's query and potentially using tools MUST be a JSON string.
This JSON string should adhere to the following structure:

{
  "natural_language_response": "A human-readable summary of the answer. This should always be present.",
  "python_code": "The Python ORM code that was generated and executed (if any). Null if no code was run.",
  "results": "The raw JSON string result from the ExecuteOrmQuery tool (if any). Null otherwise. This is the direct output of the database query.",
  "visualization": {
    "type": "string (e.g., 'table', 'bar_chart', 'line_chart', 'pie_chart', 'scatter_plot', 'diagram', 'none'). 'none' or omitting visualization means no specific visual is suggested beyond the natural language response.",
    "title": "string (Optional title for the chart/diagram, e.g., 'Sales Trend Q1')",
    "data": "array of objects (for charts, structured for Recharts, e.g., [{name: 'X', value: 10}, ...]) OR string (for diagrams, e.g., Mermaid syntax) OR null. This data should be derived from results or generated by you.",
    "options": {
        "x_axis_key": "string (The key in 'data' objects to be used for the X-axis, e.g., 'categoryName')",
        "y_axis_keys": ["string", ...] (Array of keys in 'data' objects for the Y-axis, e.g., ['totalSales', 'averagePrice'])
    }
  }
}

**Instructions for Visualization:**

1.  **Analyze Request**: When the user asks for data, consider if it's best represented by a table, a specific chart, or a diagram.
2.  **Choose Type**:
    * For trends over time: suggest 'line_chart'.
    * For comparisons between categories: suggest 'bar_chart'.
    * For proportions of a whole: suggest 'pie_chart'.
    * For relationships or processes: suggest 'diagram' and generate Mermaid.js syntax.
    * If data is tabular and no other chart is suitable: suggest 'table'.
    * If the answer is purely textual or a specific visualization isn't obvious: set 'visualization.type' to 'none'.
3.  **Data for Charts**:
    * When you generate the `python_code` for `ExecuteOrmQuery`, aim for results that can be easily used.
    * The `visualization.data` should be an array of objects. For example, if querying sales by product:
        `"data": [{"productName": "Laptop", "sales": 5000}, {"productName": "Mouse", "revenue": 300}]`
    * Specify `visualization.options.x_axis_key` (e.g., "productName") and `visualization.options.y_axis_keys` (e.g., ["sales"]).
4.  **Data for Diagrams**:
    * For `visualization.type = 'diagram'`, the `visualization.data` field should contain a string of Mermaid.js syntax. Example: `graph TD; A[Start]-->B(Process); B-->C{Decision}; C-->D[End]; C-->E[Alternative];`
5.  **Tool Usage**:
    * If you use the `ExecuteOrmQuery` tool, generate the `python_code`.
    * Your textual response (the JSON structure above) should reflect this. `python_code` will be the code you generated. `results` will be populated by the system after the tool runs. You should structure `visualization.data` based on the *expected* data from the query.

**Example User Query:** "Show me the total sales for each product category as a bar chart."

**Expected LLM Textual Output (JSON String):**
```json
{
  "natural_language_response": "Here are the total sales for each product category, displayed as a bar chart.",
  "python_code": "from api.models import Product, InvoiceLineItem\nfrom django.db.models import Sum\nresults = list(Product.objects.values('category__categoryName').annotate(total_sales=Sum('invoicelineitem__totalPrice')).order_by('-total_sales'))",
  "results": null, // System will fill this after tool execution
  "visualization": {
    "type": "bar_chart",
    "title": "Total Sales by Product Category",
    "data": null, // System can fill this from results if structured appropriately by the query or LLM explains how to derive it
    "options": {
        "x_axis_key": "category__categoryName",
        "y_axis_keys": ["total_sales"]
    }
  }
}
"""
        )
        USER_PROMPT = f"User Query: {natural_language_query}\n\nAgent, provide your response as a JSON object following the specified schema, including any Django ORM code for tool execution if necessary.\n\n Use below given system prompt as context for your response.\n\n{SYSTEM_PROMPT}"

        tools = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="ExecuteOrmQuery",
                        description=TOOL_DESCRIPTION,
                        parameters=genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            properties={
                                "python_code": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                ),
                            },
                        ),
                    ),
                ]
            )
        ]

        # Prepare Gemini API request
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=USER_PROMPT),
                ],
            ),
        ]
        generate_content_config = types.GenerateContentConfig(
            tools=tools,
            response_mime_type="text/plain",
            # system_instruction=[
            #     types.Part.from_text(text=SYSTEM_PROMPT),
            # ],
        )

        print("Total Prompt Length:", len(SYSTEM_PROMPT) + len(USER_PROMPT))

        llm_json_response_str = ""
        generated_python_code = None
        final_data_for_frontend = {"natural_language_response": "Error: Could not get a valid response from AI.", "python_code": None, "results": None, "visualization": {"type": "none", "data": None, "options": {}, "title": None}, "query": natural_language_query}

        try:
            response_chunks = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=generate_content_config,
            )

            for chunk in response_chunks:
                if chunk.text:
                    llm_json_response_str += chunk.text

                if hasattr(chunk, "candidates"):
                    for candidate in chunk.candidates:
                        for part in getattr(candidate.content, "parts", []):
                            function_call = getattr(part, "function_call", None)
                            if function_call and function_call.name == "ExecuteOrmQuery" and "python_code" in function_call.args:
                                generated_python_code = function_call.args["python_code"]
                                print(f"Generated Python Code: {generated_python_code}")
            print(f"LLM Response: {llm_json_response_str}")
            if llm_json_response_str:
                try:
                    llm_json_response_str = llm_json_response_str.replace("```json", "").replace("```", "").strip()
                    parsed_llm_json = json.loads(llm_json_response_str)
                    final_data_for_frontend.update(parsed_llm_json)
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from LLM: {e}")
                    final_data_for_frontend["natural_language_response"] = f"AI Warning: Could not parse LLM's JSON output. Raw text: {llm_json_response_str}"
                    if not final_data_for_frontend.get("natural_language_response") and llm_json_response_str:
                        final_data_for_frontend["natural_language_response"] = llm_json_response_str

            if generated_python_code or parsed_llm_json.get("python_code"):
                final_data_for_frontend["python_code"] = generated_python_code
                orm_result_str = ExecuteOrmQuery(generated_python_code)
                print(f"ORM Result: {orm_result_str}")
                final_data_for_frontend["results"] = orm_result_str

                vis_info = final_data_for_frontend.get("visualization", {})
                if vis_info.get("type") not in ["none", "diagram"] and vis_info.get("data") is None:
                    try:
                        vis_info["data"] = json.loads(orm_result_str)
                    except json.JSONDecodeError:
                        vis_info["data"] = orm_result_str
                        final_data_for_frontend["natural_language_response"] = vis_info
                        print(f"Warning: results ('{orm_result_str}') could not be parsed as JSON for visualization.data.")
                final_data_for_frontend["visualization"] = vis_info

            if not final_data_for_frontend.get("natural_language_response") and not generated_python_code:
                final_data_for_frontend["natural_language_response"] = "No specific action was taken or information retrieved. Please try rephrasing your query."

        except Exception as e:
            print(f"Error in query_database: {e}")
            final_data_for_frontend["natural_language_response"] = f"An error occurred while processing your request: {e}"
            final_data_for_frontend["visualization"]["type"] = "none"

        return final_data_for_frontend
