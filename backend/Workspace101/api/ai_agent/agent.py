import os
import time
import uuid
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from django.db.models import Sum, Count, Avg, Max, Min
from api.models import Product, Category, BusinessType,  Vendor, Invoice, InvoiceLineItem
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
GITHUB_ACCESS_TOKEN = os.getenv("GITHUB_ACCESS_TOKEN")


def get_github_copilot_token():
    """Get a GitHub Copilot API token using access token"""
    try:
        resp = requests.get('https://api.github.com/copilot_internal/v2/token', headers={
            'authorization': f'token {GITHUB_ACCESS_TOKEN}',
            'editor-version': 'Neovim/0.6.1',
            'editor-plugin-version': 'copilot.vim/1.16.0',
            'user-agent': 'GithubCopilot/1.155.0'
        })
        
        if resp.status_code == 200:
            resp_json = resp.json()
            token = resp_json.get('token')
            return token
        else:
            print(f"Failed to get GitHub Copilot token: {resp.status_code}")
            return None
    except Exception as e:
        print(f"Error getting GitHub Copilot token: {e}")
        return None

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
    if not python_code:
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
            return "Error: The executed code did not produce a 'results' variable. CLI Output: " + cli_output
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

    def __init__(self, temperature=0.1, use_copilot=False):
        self.use_copilot = use_copilot
        self.temperature = temperature
        
        if use_copilot:
            # GitHub Copilot configuration
            self.model_name = "gpt-4.1"
            self.endpoint = "https://api.individual.githubcopilot.com"
            self.vision = False
            self.copilot_token = None
        else:
            # Gemini configuration
            # self.model_name = model_name
            self.model_name = "gemini-2.5-flash-preview-04-17"
            # self.model_name = "gemini-2.5-flash-preview-05-20"
            self.client = genai.Client(api_key=GEMINI_API_KEY)
            self.cache = None

    def _get_copilot_headers(self):
        """Get headers for GitHub Copilot API requests"""
        if not self.copilot_token:
            self.copilot_token = get_github_copilot_token()
            if not self.copilot_token:
                raise Exception("Failed to get GitHub Copilot token")
        
        headers = {
            "Authorization": f"Bearer {self.copilot_token}",
            "Content-Type": "application/json",
            "accept": "application/json",
            "copilot-integration-id": "vscode-chat",
            "editor-version": 'vscode/1.103.0',
            "editor-plugin-version": 'copilot-chat/1.350.0',
            "user-agent": 'GitHubCopilotChat/1.350.0',
            "openai-intent": "conversation-panel",
            "x-github-api-version": '2025-04-01',
            "x-request-id": str(uuid.uuid4()),
            "x-vscode-user-agent-library-version": "electron-fetch",
        }
        
        if self.vision:
            headers["copilot-vision-request"] = "true"
            
        return headers

    def _query_copilot_api(self, messages, max_tokens=1024):
        """Query GitHub Copilot API"""
        try:
            headers = self._get_copilot_headers()
            
            response = requests.post(
                f"{self.endpoint}/chat/completions",
                headers=headers,
                json={
                    "messages": messages,
                    "model": self.model_name,
                    "max_tokens": max_tokens,
                    "temperature": self.temperature,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"GitHub Copilot API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error querying GitHub Copilot API: {e}")
            return None

    def query_database(self, natural_language_query: str, chat_history: list = None, max_retries: int = 5) -> str:
        """
        Processes a natural language query and uses the AI agent to interact with the database.
        Supports both Gemini and GitHub Copilot APIs with internal retry mechanism for failed queries.
        All retries happen within this single method call.
        """
        if chat_history is None:
            chat_history = []

        # Read system prompt from file (if needed)
        with open("./api/ai_agent/modelContext.txt", "r") as file:
            final_system_prompt = file.read()

        retry_count = 0
        current_query = natural_language_query
        current_chat_history = chat_history.copy()
        retry_attempts = []

        while retry_count <= max_retries:
            print(f"Attempt {retry_count + 1} of {max_retries + 1} for query: {current_query[:100]}...")
            
            # Execute the query
            if self.use_copilot:
                result = self._query_database_with_copilot(current_query, final_system_prompt, current_chat_history, retry_count)
            else:
                result = self._query_database_with_gemini(current_query, final_system_prompt, current_chat_history, retry_count)
            
            # Add attempt information for tracking
            result["retry_count"] = retry_count
            result["retry_attempts"] = retry_attempts.copy()
            
            # Check if we got a successful result (no ORM errors)
            if not self._should_retry_query(result, retry_count, max_retries):
                if retry_count > 0:
                    result["natural_language_response"] = f"✅ Query successful after {retry_count + 1} attempts. {result.get('natural_language_response', '')}"
                return result
            
            # If we need to retry, prepare for next iteration
            retry_count += 1
            error_message = result.get("results", "Unknown error")
            failed_code = result.get("python_code", "")
            
            # Store this attempt for reference
            retry_attempts.append({
                "attempt": retry_count,
                "error": error_message,
                "code": failed_code
            })
            
            if retry_count <= max_retries:
                # Create follow-up query for next attempt
                current_query, current_chat_history = self._create_follow_up_query(
                    natural_language_query, result, current_chat_history, retry_count, max_retries
                )
                print(f"Retrying due to error: {error_message[:200]}...")
            else:
                # Max retries reached
                result["natural_language_response"] = f"❌ After {max_retries + 1} attempts, I was unable to generate a correct database query. Final error: {error_message}. Please try rephrasing your query or check if the requested data exists in the database."
                result["retry_count"] = retry_count
                result["retry_attempts"] = retry_attempts
                return result
        
        return result
    
    def _should_retry_query(self, result: dict, retry_count: int, max_retries: int) -> bool:
        """
        Determine if a query should be retried based on the error type and retry count.
        """
        if retry_count >= max_retries:
            return False
        
        # Check if the result contains ORM-related errors that can be fixed with a follow-up
        results = result.get("results", "")
        if isinstance(results, str):
            error_indicators = [
                "FieldError - Cannot resolve keyword",
                "Field does not exist",
                "Database Programming Error",
                "incorrect query structure",
                "column name"
            ]
            return any(indicator in results for indicator in error_indicators)
        
        return False
    
    def _is_orm_error(self, result: dict) -> bool:
        """
        Check if the result contains an ORM-related error.
        """
        results = result.get("results", "")
        if isinstance(results, str):
            error_indicators = [
                "FieldError",
                "Field does not exist", 
                "Database Programming Error",
                "Django ORM Error",
                "Error executing Django ORM query"
            ]
            return any(indicator in results for indicator in error_indicators)
        return False
    
    def _create_follow_up_query(self, original_query: str, failed_result: dict, chat_history: list, retry_count: int, max_retries: int) -> tuple:
        """
        Create a follow-up question based on the error and return updated query and chat history.
        Returns: (new_query, updated_chat_history)
        """
        error_message = failed_result.get("results", "Unknown error")
        failed_code = failed_result.get("python_code", "")
        
        # Create a more specific follow-up based on error type
        if "Cannot resolve keyword" in error_message:
            error_field = self._extract_error_field(error_message)
            follow_up_query = f"""
CORRECTION NEEDED - Field Error Detected:

Previous attempt failed: {error_message}
Failed code: {failed_code}

The field '{error_field}' doesn't exist in the model. Please check the exact field names in the Django models and relationships.

Original request: "{original_query}"

Please generate a corrected Django ORM query using the correct field names and relationships.
Retry {retry_count} of {max_retries}.
"""
        else:
            follow_up_query = f"""
CORRECTION NEEDED - Database Query Error:

Previous attempt failed with: {error_message}
Failed code: {failed_code}

Original request: "{original_query}"

Please analyze the error and generate a corrected Django ORM query. Pay attention to:
1. Correct field names and relationships
2. Proper use of Django ORM syntax
3. Model schema requirements

Retry {retry_count} of {max_retries}.
"""
        
        # Add the error context to chat history
        updated_chat_history = chat_history + [
            {"role": "user", "content": original_query},
            {"role": "assistant", "content": f"Error: {error_message}"},
            {"role": "user", "content": follow_up_query}
        ]
        
        return follow_up_query, updated_chat_history
    
    def _extract_error_field(self, error_message: str) -> str:
        """
        Extract the problematic field name from the error message.
        """
        import re
        match = re.search(r"Cannot resolve keyword '([^']+)'", error_message)
        return match.group(1) if match else "unknown_field"

    def _query_database_with_copilot(self, natural_language_query: str, final_system_prompt: str, chat_history: list, retry_count: int = 0):
        """Query database using GitHub Copilot API"""
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
Always return the data in "results" constant as that will be used for the final response.

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
    * The final data structure should include the `results` field populated with the query results.
    * Your textual response (the JSON structure above) should reflect this. `python_code` will be the code you generated. `results` will be populated by the system after the tool runs. You should structure `visualization.data` based on the *expected* data from the query.

**Example for valid and invalid python code**
    * Invalid code:
        from api.models import Category
        categories = list(Category.objects.values('categoryId', 'name', 'parentId'))
    * Valid Code:
        from api.models import Category
        results = list(Category.objects.values('categoryId', 'name', 'parentId'))

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

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        
        # Add chat history if this is a retry
        if chat_history:
            for chat_msg in chat_history:
                messages.append(chat_msg)
        else:
            messages.append({"role": "user", "content": f"User Query: {natural_language_query}"})

        final_data_for_frontend = {
            "natural_language_response": "Error: Could not get a valid response from AI.",
            "python_code": None,
            "results": None,
            "visualization": {"type": "none", "data": None, "options": {}, "title": None},
            "query": natural_language_query,
            "retry_count": retry_count,
            "retry_attempts": []
        }

        try:
            response = self._query_copilot_api(messages, max_tokens=1024)
            
            if response and 'choices' in response and len(response['choices']) > 0:
                llm_response = response['choices'][0]['message']['content']
                print(f"GitHub Copilot Response: {llm_response}")
                
                try:
                    # Clean and parse JSON response
                    llm_response = llm_response.replace("```json", "").replace("```", "").strip()
                    parsed_response = json.loads(llm_response)
                    final_data_for_frontend.update(parsed_response)
                    
                    # Execute Python code if provided
                    if parsed_response.get("python_code"):
                        orm_result_str = ExecuteOrmQuery(parsed_response["python_code"])
                        if "Error:" not in orm_result_str:
                            print(f"ORM Result: {orm_result_str}")
                            final_data_for_frontend["results"] = orm_result_str
                        
                            # Update visualization data if needed
                            vis_info = final_data_for_frontend.get("visualization", {})
                            if vis_info.get("type") not in ["none", "diagram"] and vis_info.get("data") is None:
                                try:
                                    vis_info["data"] = json.loads(orm_result_str)
                                except json.JSONDecodeError:
                                    vis_info["data"] = orm_result_str
                            final_data_for_frontend["visualization"] = vis_info
                        else:
                            raise ValueError("Error occurred while executing ORM query")

                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from GitHub Copilot: {e}")
                    final_data_for_frontend["natural_language_response"] = f"AI Warning: Could not parse response. Raw text: {llm_response}"
            else:
                final_data_for_frontend["natural_language_response"] = "No response received from GitHub Copilot API."

        except Exception as e:
            print(f"Error in GitHub Copilot query: {e}")
            final_data_for_frontend["natural_language_response"] = f"An error occurred while processing your request: {e}"

        return final_data_for_frontend

    def _query_database_with_gemini(self, natural_language_query: str, final_system_prompt: str, chat_history: list, retry_count: int = 0):
        """Query database using Gemini API (original implementation)"""
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
        
        # Build the user prompt with chat history if this is a retry
        chat_context = ""
        if chat_history:
            chat_context = "\n\nPrevious conversation context:\n"
            for i, msg in enumerate(chat_history):
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                chat_context += f"{role.title()}: {content}\n"
            chat_context += "\nBased on the above context and any errors, please provide a corrected response.\n"
        
        USER_PROMPT = f"User Query: {natural_language_query}{chat_context}\n\nAgent, provide your response as a JSON object following the specified schema, including any Django ORM code for tool execution if necessary.\n\n Use below given system prompt as context for your response.\n\n{SYSTEM_PROMPT}"

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
        final_data_for_frontend = {"natural_language_response": "Error: Could not get a valid response from AI.", "python_code": None, "results": None, "visualization": {"type": "none", "data": None, "options": {}, "title": None}, "query": natural_language_query, "retry_count": retry_count, "retry_attempts": []}

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
                    llm_json_response_str = llm_json_response_str.replace("```json", "").replace("```", "")
                    parsed_llm_json = json.loads(llm_json_response_str)
                    final_data_for_frontend.update(parsed_llm_json)
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from LLM: {e}")
                    final_data_for_frontend["natural_language_response"] = f"AI Warning: Could not parse LLM's JSON output. Raw text: {llm_json_response_str}"
                    if not final_data_for_frontend.get("natural_language_response") and llm_json_response_str:
                        final_data_for_frontend["natural_language_response"] = llm_json_response_str

            if generated_python_code or parsed_llm_json.get("python_code"):
                finalCode = parsed_llm_json.get("python_code", generated_python_code)
                final_data_for_frontend["python_code"] = finalCode
                orm_result_str = ExecuteOrmQuery(finalCode)
                # print(f"ORM Result: {orm_result_str}")
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
