import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import json
import time
import traceback
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# IMPORTANT: It is recommended to use environment variables for API keys.
# For this example, we'll use a placeholder. Replace with your actual key or set as an environment variable.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
searpApi = "db2606ec0664d3016ae1660375bce6f1d803b081"

# Replaced f-string
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}".format(GEMINI_API_KEY)

# Expanded and refined product categories
PRODUCT_CATEGORIES = ["Vape Devices and Vaporizers (Disposable and Refillable)", "E-Liquids (Nicotine and Nicotine-Free)", "Hemp-Derived Products (CBD, CBG, CBN)", "Delta-8, Delta-10, HHC, and THCa Products", "Kratom (Powders, Capsules, Extracts)", "Hookah, Shisha Tobacco, and Charcoals", "Premium Cigars and Rolling Papers", "Energy Drinks and Nootropic Beverages", "Imported and Specialty Snacks (e.g., Mexican Candy)", "Adult Novelty and Wellness Products", "Smoke Shop Supplies (Glassware, Grinders, Displays)"]
JURISDICTION = "Georgia, USA"


# def SearpApiFunction(query: str, max_results: int = 10):
#     url = "https://google.serper.dev/search"

#     payload = json.dumps({"q": query, "location": "Atlanta, Georgia, United States"})
#     headers = {"X-API-KEY": searpApi, "Content-Type": "application/json"}

#     response = requests.request("POST", url, headers=headers, data=payload)
#     return response.json().get("organic", [])[:max_results]

def parse_search_results(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    search_results = []
    result_items = soup.find_all('li', class_='b_algo')
    for item in result_items:
        try:
            link_tag = item.find('div', class_='b_tpcn').find('a')
            link = link_tag['href']
            title_tag = item.find('h2').find('a')
            title = title_tag.text.strip()
            description_tag = item.find('div', class_='b_caption')
            description = description_tag.find('p').text.strip() if description_tag else ""

            search_results.append({
                'link': link,
                'title': title,
                'snippet': description,
            })
        except AttributeError:
            print("Skipping result due to missing elements.")
            continue
    return search_results
def scrape_bing_results(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:22.0) Gecko/20100101 Firefox/22.0'}
        response = requests.get(url=url, headers=headers)

        soup_bing = BeautifulSoup(response.content.decode('utf-8'), "lxml")
        return soup_bing
    except requests.exceptions.RequestException as e:
        print(f"Error fetching or parsing URL: {e}")
        return None
    
def SearpApiFunction(query: str, max_results: int = 10):
    url = f"https://www.bing.com/search?q={query}"
    soup = scrape_bing_results(url)
    if soup:
        results = parse_search_results(soup.prettify())
        tempResults = []
        for result in results:
            response = requests.get(result['link'])
            url = response.text.split('var u = "')[1].split('"')[0]
            tempResults.append({
                'link': url,
                'title': result['title'],
                'snippet': result['snippet'],
            })
        # print(f"Found {len(results)} results for query: {query}")
        return tempResults[:max_results]
    else:
        return []

class WebSearchTool:
    """A tool for performing general web searches using DuckDuckGo."""

    def search(self, query: str, max_results: int = 5):
        # yield {"type": "status", "agent": "WebSearchTool", "phase": "SEARCH", "message": f"Searching for query: {query}", "details": {"query": query}}
        try:
            return SearpApiFunction(query, max_results=max_results)
        except Exception as e:
            # yield {"type": "error", "agent": "WebSearchTool", "phase": "SEARCH", "message": f"Error during web search for query: {query}", "details": {"query": query, "error": str(e)}}
            return []


class SocialMediaSearchTool:
    """A tool for searching social media platforms for consumer sentiment."""

    def search(self, query: str, max_results: int = 5):
        # yield {"type": "status", "agent": "SocialMediaSearchTool", "phase": "SOCIAL_SEARCH", "message": f"Searching social media for: {query}", "details": {"query": query}}
        try:
            # Focus on Reddit for candid conversations
            social_query = f"site:reddit.com {query}"
            return SearpApiFunction(social_query, max_results=max_results)
        except Exception as e:
            # yield {"type": "error", "agent": "SocialMediaSearchTool", "phase": "SOCIAL_SEARCH", "message": f"Error during social media search for: {query}", "details": {"query": query, "error": str(e)}}
            return []


# class WebScraperTool:
#     """A tool for scraping and cleaning content from a URL."""

#     def scrape(self, url: str):
#         # yield {"type": "status", "agent": "WebScraperTool", "phase": "SCRAPE", "message": f"Scraping URL: {url}", "details": {"url": url}}
#         try:
#             payload = json.dumps({
#             "url":  url,
#             })
#             headers = {
#                 'X-API-KEY':  searpApi,
#                 'Content-Type': 'application/json'
#             }

#             response = requests.request("POST", "https://scrape.serper.dev", headers=headers, data=payload)

#             return response.json().get("text", "")[:8000]
#         except requests.RequestException as e:
#             # yield {"type": "error", "agent": "WebScraperTool", "phase": "SCRAPE", "message": f"Error scraping URL: {url}", "details": {"url": url, "error": str(e)}}
#             return None
class WebScraperTool:
    """A tool for scraping and cleaning content from a URL."""
    def scrape(self, url: str):
        # yield {"type": "status", "agent": "WebScraperTool", "phase": "SCRAPE", "message": f"Scraping URL: {url}", "details": {"url": url}}
        try:
            response = requests.get(url)
            soup_bing = BeautifulSoup(response.content.decode('utf-8'), "lxml")
            htmlContent = str(soup_bing.get_text()).strip()
            htmlContent = re.sub(r'\s{2,}', ' ', htmlContent)
            # print(f"Scraped content from {url[:50]}... with length {len(htmlContent)} characters.")
            return htmlContent[:8000]  # Limit to 8000 characters
        except requests.RequestException as e:
            # yield {"type": "error", "agent": "WebScraperTool", "phase": "SCRAPE", "message": f"Error scraping URL: {url}", "details": {"url": url, "error": str(e)}}
            return None


class GeminiLLM:
    """A wrapper for the Gemini LLM API with error handling."""

    def __init__(self, api_url: str):
        self.api_url = api_url

    def _make_request(self, prompt: str):
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4, "topP": 0.95, "topK": 40}}
        headers = {"Content-Type": "application/json"}
        time.sleep(2)  # Rate limiting
        try:
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=45)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print({"type": "error", "agent": "GeminiLLM", "phase": "API_CALL", "message": "Error calling Gemini API", "details": {"error": str(e)}})
            if hasattr(e, "response") and e.response:
                print({"type": "error_detail", "agent": "GeminiLLM", "phase": "API_CALL", "message": "Received error response body from API", "details": {"response_body": e.response.text}})
            return None

    def analyze(self, prompt: str):
        result = self._make_request(prompt)
        if result and "candidates" in result and result["candidates"][0].get("content", {}).get("parts"):
            return result["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print({"type": "error", "agent": "GeminiLLM", "phase": "ANALYZE", "message": "Could not parse LLM response.", "details": {"raw_response": result}})
            return "Error: Analysis failed due to an invalid API response."

    def analyze_json(self, prompt: str):
        raw_response = self.analyze(prompt)
        try:
            # Clean the response string from markdown code blocks
            if raw_response is None:
                return {"error": "No response from LLM"}
            clean_str = raw_response.strip().replace("```json", "").replace("```", "").strip()
            result = json.loads(clean_str)
            return result
        except (json.JSONDecodeError, AttributeError) as e:
            print({"type": "error", "agent": "GeminiLLM", "phase": "ANALYZE_JSON", "message": "Failed to decode JSON from LLM response.", "details": {"error": str(e), "raw_response": raw_response}})
            return {"error": "Failed to parse JSON response from LLM.", "raw_response": raw_response}


class MarketResearchAgent:
    """Agent that finds trending products, market sentiment, and innovations."""

    def __init__(self, llm: GeminiLLM, search_tool: WebSearchTool, social_tool: SocialMediaSearchTool, scraper_tool: WebScraperTool):
        self.llm, self.search_tool, self.social_tool, self.scraper_tool = llm, search_tool, social_tool, scraper_tool
        self.name = "Market Research Agent (MRA)"

    def research_category(self, category: str):
        # yield {"type": "agent_start", "agent": self.name, "phase": "RESEARCH_CATEGORY", "message": f"Starting research for category: {category}", "details": {"category": category}}
        search_queries = [f"new product trends in {category} 2025", f"top selling {category} products wholesale B2B", f"innovations and future of {category}"]
        social_queries = [f"honest review {category}", f"what's the best {category} right now", f"underrated {category} products"]

        all_content, sources = "", set()

        for query in search_queries:
            search_results = self.search_tool.search(query, max_results=7)
            if search_results:
                for result in search_results:
                    content = self.scraper_tool.scrape(result["link"])
                    if content:
                        all_content += f"\n\n--- Web Source: {result['title']} ({result['link']}) ---\n{content}"
                        sources.add(result["link"])

        for query in social_queries:
            search_results = self.social_tool.search(query, max_results=7)
            if search_results:
                for result in search_results:
                    all_content += f"\n\n--- Social Source: {result['title']} ({result['link']}) ---\n{result['snippet']}"
                    sources.add(result["link"])

        if not all_content:
            return {"analysis": {"category": category, "error": "No content could be gathered."}, "sources": []}

        prompt = f"""
        You are a senior market analyst for a large CPG wholesale distributor.
        Analyze the following compilation of web articles and social media posts about the '{category}' category.
        Your task is to extract actionable intelligence for the purchasing department.
        Provide a structured JSON output with the following keys:
        - "emerging_trends": A list of 2-4 key emerging trends (e.g., "New flavor profiles", "High-potency options", "Eco-friendly packaging").
        - "key_drivers": A string explaining the main factors driving these trends (e.g., "Gen Z preferences", "Regulatory changes", "Health-consciousness").
        - "consumer_sentiment": A single descriptive string: "Very Positive", "Positive", "Mixed", "Cautious", or "Negative". Base this heavily on the social media source content.
        - "currently_trending_products": A list of 3-5 specific product types or brands that are popular *right now*. Be specific.
        - "upcoming_innovations": A list of 2-4 product types, technologies, or concepts that are on the horizon or in early stages of market entry.

        Article and Social Media Compilation:\n---\n{all_content}\n---
        
        Output ONLY the JSON object.
        """
        analysis = self.llm.analyze_json(prompt)
        analysis = analysis if isinstance(analysis, dict) else {"error": "Invalid analysis result"}
        
        if "error" not in analysis and analysis is not None:
            analysis["category"] = category
            # yield {"type": "agent_end", "agent": self.name, "phase": "RESEARCH_CATEGORY", "message": f"Successfully analyzed category: {category}", "details": {"category": category}}
        
        return {"analysis": analysis, "sources": list(sources)}


class RegulatoryComplianceAgent:
    """Agent that monitors the regulatory landscape."""

    def __init__(self, llm: GeminiLLM, search_tool: WebSearchTool, scraper_tool: WebScraperTool):
        self.llm, self.search_tool, self.scraper_tool = llm, search_tool, scraper_tool
        self.name = "Regulatory Compliance Agent (RCA)"

    def check_compliance(self, category: str, jurisdiction: str):
        # yield {"type": "agent_start", "agent": self.name, "phase": "CHECK_COMPLIANCE", "message": f"Checking compliance for '{category}' in '{jurisdiction}'", "details": {"category": category, "jurisdiction": jurisdiction}}
        high_risk_keywords = ["vape", "delta", "kratom", "tobacco", "smoking", "hemp", "cbd", "adult", "thca", "hhc"]
        if not any(keyword in category.lower() for keyword in high_risk_keywords):
            return {"analysis": {"status": "Go", "risk_level": "Low", "summary": "Standard consumer product regulations apply. No specific restrictions identified."}, "sources": []}

        search_queries = [f"laws and regulations for selling {category} in {jurisdiction}", f"new {category} legislation {jurisdiction} 2025", f"{category} FDA regulations USA federal", f"{jurisdiction} Department of Revenue {category} rules"]
        all_content, sources = "", set()
        for query in search_queries:
            search_results = self.search_tool.search(query, max_results=7)
            if search_results:
                for result in search_results:
                    # if any(domain in result["link"] for domain in [".gov", ".org", "fda.gov", "ga.gov"]):
                    content = self.scraper_tool.scrape(result["link"])
                    if content:
                        all_content += f"\n\n--- Source: {result['title']} ({result['link']}) ---\n{content}"
                        sources.add(result["link"])

        if not all_content:
            return {"analysis": {"status": "Watch", "risk_level": "Medium", "summary": "Could not find definitive regulatory information from official sources. Manual review required."}, "sources": []}

        prompt = f"""
        You are a compliance officer specializing in CPG products. Analyze the provided text regarding regulations for '{category}' in {jurisdiction}.
        Provide a structured JSON output with three keys:
        - "status": Choose one: "Go" (legal to sell), "Watch" (legal but with significant restrictions or pending changes), or "No-Go" (illegal or prohibitively restricted).
        - "risk_level": Choose one: "Low", "Medium", "High".
        - "summary": A concise paragraph detailing key restrictions (age limits, potency caps, flavor bans, licensing requirements, advertising rules) and any recent or upcoming legal changes.

        Regulatory Text:\n---\n{all_content}\n---
        
        Output ONLY the JSON object.
        """
        status = self.llm.analyze_json(prompt)
        # yield {"type": "agent_end", "agent": self.name, "phase": "CHECK_COMPLIANCE", "message": f"Successfully checked compliance for: {category}", "details": {"category": category}}
        return {"analysis": status, "sources": list(sources)}


class CompetitiveIntelligenceAgent:
    """Agent that analyzes the competitive landscape."""

    def __init__(self, llm: GeminiLLM, search_tool: WebSearchTool, scraper_tool: WebScraperTool):
        self.llm, self.search_tool, self.scraper_tool = llm, search_tool, scraper_tool
        self.name = "Competitive Intelligence Agent (CIA)"

    def analyze_competitors(self, category: str):
        # yield {"type": "agent_start", "agent": self.name, "phase": "ANALYZE_COMPETITORS", "message": f"Analyzing competitors for: {category}", "details": {"category": category}}
        search_queries = [f"top wholesale distributors for {category} USA", f"major online retailers for {category}"]
        all_content, sources = "", set()
        for query in search_queries:
            search_results = self.search_tool.search(query, max_results=7)
            if search_results:
                for result in search_results:
                    content = self.scraper_tool.scrape(result["link"])
                    if content:
                        all_content += f"\n\n--- Competitor Source: {result['title']} ({result['link']}) ---\n{content}"
                        sources.add(result["link"])

        if not all_content:
            return {"analysis": {"error": "Could not find competitor information."}, "sources": []}

        prompt = f"""
        You are a competitive intelligence analyst. From the scraped text of competitor websites, identify key information about the '{category}' market.
        Provide a structured JSON output with:
        - "key_competitors": A list of 2-3 names of competing distributors or large retailers.
        - "promoted_brands": A list of specific brand names that appear to be heavily promoted or featured.
        - "competitor_focus": A short string describing what competitors seem to be focusing on (e.g., "High-end disposables", "Budget-friendly e-liquids", "Organic and natural products").

        Scraped Competitor Data:\n---\n{all_content}\n---

        Output ONLY the JSON object.
        """
        analysis = self.llm.analyze_json(prompt)
        # yield {"type": "agent_end", "agent": self.name, "phase": "ANALYZE_COMPETITORS", "message": f"Successfully analyzed competitors for: {category}", "details": {"category": category}}
        return {"analysis": analysis, "sources": list(sources)}


class SupplierDiscoveryAgent:
    """Agent that finds potential suppliers for high-opportunity products."""

    def __init__(self, llm: GeminiLLM, search_tool: WebSearchTool):
        self.llm, self.search_tool = llm, search_tool
        self.name = "Supplier Discovery Agent (SDA)"

    def find_suppliers(self, products: list):
        # yield {"type": "agent_start", "agent": self.name, "phase": "FIND_SUPPLIERS", "message": "Finding suppliers for top products.", "details": {"products": products}}
        if not products:
            return {}

        suppliers = {}
        for product in products:
            query = f'"{product}" wholesale supplier distributor USA'
            search_results = self.search_tool.search(query, max_results=7)

            if not search_results:
                suppliers[product] = [{"name": "No direct suppliers found via search.", "url": "#"}]
                continue

            prompt = f"""
            From the following search results for "{product}", identify up to 2 potential B2B suppliers or distributors.
            For each, provide their name and a direct URL to their website.
            Do not list retailers or informational sites. Focus on wholesale/distribution.
            
            Search Results:
            {json.dumps(search_results, indent=2)}

            Provide a JSON list where each object has a "name" and "url" key.
            Example: [{{"name": "Global Vapes Wholesale", "url": "https://globalvapes.com"}}]
            Output ONLY the JSON object.
            """
            supplier_list = self.llm.analyze_json(prompt)
            if "error" in supplier_list or not isinstance(supplier_list, list):
                suppliers[product] = [{"name": "Could not identify suppliers from search.", "url": "#"}]
            else:
                suppliers[product] = supplier_list

        # yield {"type": "agent_end", "agent": self.name, "phase": "FIND_SUPPLIERS", "message": "Finished supplier discovery.", "details": {}}
        return suppliers


class ReportingAgent:
    """Agent that synthesizes all findings into a detailed HTML report."""

    def __init__(self, llm: GeminiLLM, theme="indigo"):
        self.llm = llm
        self.name = "Reporting Agent (RA)"
        self.theme = theme

    def _calculate_opportunity_score(self, market_analysis, compliance_analysis):
        if "error" in market_analysis or "error" in compliance_analysis:
            return 0
        score = 50
        sentiment_map = {"Very Positive": 20, "Positive": 10, "Mixed": 0, "Cautious": -10, "Negative": -25}
        score += sentiment_map.get(market_analysis.get("consumer_sentiment"), 0)

        risk_map = {"Low": 15, "Medium": -15, "High": -30}
        score += risk_map.get(compliance_analysis.get("risk_level"), -15)

        if compliance_analysis.get("status") == "No-Go":
            return 0
        if compliance_analysis.get("status") == "Watch":
            score -= 10

        return max(0, min(100, score))

    def _get_recommendation(self, item):
        market = item["market_data"]["analysis"]
        compliance = item["compliance_data"]["analysis"]
        competition = item["competition_data"]["analysis"]

        recommendation_prompt = f"""
        As a Senior Purchasing Analyst, write a final "Actionable Recommendation" for the '{item["category"]}' category.
        Justify your conclusion by weighing market opportunity against regulatory risks and the competitive landscape.
        Keep it to a concise, direct paragraph.

        - Market Trends: {market.get("emerging_trends", "N/A")}
        - Consumer Sentiment: {market.get("consumer_sentiment", "N/A")}
        - Trending Products: {market.get("currently_trending_products", "N/A")}
        - Regulatory Status ({compliance.get("status", "N/A")} ({compliance.get("risk_level", "N/A")} Risk)
        - Competitor Focus: {competition.get("competitor_focus", "N/A")}
        - Calculated Opportunity Score: {item["opportunity_score"]}/100

        Based on this, what is the final recommendation? (e.g., "Aggressively Pursue", "Test Market", "Monitor Closely", "Avoid"). Justify it.
        """
        return self.llm.analyze(recommendation_prompt)

    def generate_report(self, all_data: list, supplier_data: dict):
        yield {"type": "agent_start", "agent": self.name, "phase": "GENERATE_REPORT", "message": "Generating final HTML intelligence report."}

        summary_prompt = f"""
        You are the Director of Purchasing Intelligence. Review the summarized findings below from your team of agents.
        Write a 2-3 paragraph Executive Summary for the Head of Purchasing.
        - Start by stating the highest opportunity categories.
        - Highlight the most significant growth areas and specific product types to focus on.
        - Point out the critical risks, especially categories with "High" risk or "Watch" status in {JURISDICTION}.
        - Conclude by recommending immediate actions for the purchasing team.
        
        Findings:\n---\n{json.dumps(all_data, indent=2)}\n---
        
        Provide only the text for the executive summary.
        """
        executive_summary = self.llm.analyze(summary_prompt)
        if executive_summary:
            executive_summary = executive_summary.strip().replace("\n", "<br>")

        sorted_data = sorted(all_data, key=lambda x: x["opportunity_score"], reverse=True)

        report_sections_html = ""
        for item in sorted_data:
            market = item["market_data"]["analysis"]
            compliance = item["compliance_data"]["analysis"]
            competition = item["competition_data"]["analysis"]

            if any("error" in d for d in [market, compliance, competition]):
                continue

            sentiment_colors = {"Very Positive": "bg-green-100 text-green-800 border border-green-500 shadow-inner", "Positive": "bg-blue-100 text-blue-800 border border-blue-500 shadow-inner", "Mixed": "bg-yellow-100 text-yellow-800 border border-yellow-500 shadow-inner", "Cautious": "bg-orange-100 text-orange-800 border border-orange-500 shadow-inner", "Negative": "bg-red-100 text-red-800 border border-red-500 shadow-inner"}
            risk_colors = {"Low": "bg-green-100 text-green-800 border border-green-500 shadow-inner", "Medium": "bg-yellow-100 text-yellow-800 border border-yellow-500 shadow-inner", "High": "bg-red-100 text-red-800 border border-red-500 shadow-inner"}
            status_colors = {"Go": "bg-green-100 text-green-800 border border-green-500 shadow-inner", "Watch": "bg-orange-100 text-orange-800 border border-orange-500 shadow-inner", "No-Go": "bg-red-100 text-red-800 border border-red-500 shadow-inner"}

            recommendation = self._get_recommendation(item)

            market_sources = item["market_data"]["sources"]
            compliance_sources = item["compliance_data"]["sources"]
            competition_sources = item["competition_data"]["sources"]
            all_sources = sorted(list(set(market_sources + compliance_sources + competition_sources)))

            sources_html = "".join([f'<li class="truncate"><a href="{source}" target="_blank" class="text-blue-600 hover:underline">{source}</a></li>' for source in all_sources])

            report_sections_html += f"""
            <div class="border-t-2 border-white bg-gradient-to-br from-{self.theme}-50 via-white to-white p-6 rounded-lg shadow-md mb-8 break-inside-avoid">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-2xl font-bold text-gray-800">{item["category"]}</h2>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">Opportunity Score</p>
                        <p class="text-3xl font-bold text-{self.theme}-600">{item["opportunity_score"]}</p>
                    </div>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                    <div class="bg-{self.theme}-600 h-2.5 rounded-full" style="width: {item["opportunity_score"]}%"></div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-300 shadow-inner">
                    <h3 class="font-bold text-lg text-gray-900 mb-2">Actionable Recommendation</h3>
                    <p class="text-gray-700">{recommendation}</p>
                </div>
                <div class="grid gap-6">
                    <div class="bg-blue-50 border border-blue-300 p-4 rounded-lg shadow-inner">
                        <h4 class="font-semibold text-blue-900 mb-3">Market Analysis</h4>
                        <p class="mb-2"><strong class="font-medium text-gray-700">Sentiment:</strong> <span class="text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full {sentiment_colors.get(market.get("consumer_sentiment"), "bg-gray-100 text-gray-800")}">{market.get("consumer_sentiment", "N/A")}</span></p>
                        <p class="mb-2"><strong class="font-medium text-gray-700">Trends:</strong> {", ".join(market.get("emerging_trends", ["N/A"]))}</p>
                        <p class="text-sm text-gray-600 mt-2"><strong class="font-medium text-gray-700">Drivers:</strong> {market.get("key_drivers", "N/A")}</p>
                    </div>
                    <div class="bg-green-50 border border-green-500 p-4 rounded-lg shadow-inner">
                        <h4 class="font-semibold text-green-900 mb-3">Product Intelligence</h4>
                        <p class="mb-2"><strong class="font-medium text-gray-700">Trending Now:</strong> {", ".join(market.get("currently_trending_products", ["N/A"]))}</p>
                        <p><strong class="font-medium text-gray-700">Innovations:</strong> {", ".join(market.get("upcoming_innovations", ["N/A"]))}</p>
                    </div>
                    <div class="bg-red-50 border border-red-300 p-4 rounded-lg shadow-inner">
                        <h4 class="font-semibold text-red-900 mb-3">Risk & Competition</h4>
                        <p class="mb-2"><strong class="font-medium text-gray-700">Regulatory ({JURISDICTION}):</strong> <span class="text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full {status_colors.get(compliance.get("status"), "bg-gray-100 text-gray-800")}">{compliance.get("status", "N/A")}</span><span class="text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full {risk_colors.get(compliance.get("risk_level"), "bg-gray-100 text-gray-800")}">{compliance.get("risk_level", "N/A")} Risk</span></p>
                        <p class="text-sm text-gray-600 mb-2">{compliance.get("summary", "N/A")}</p>
                        <p class="mt-3"><strong class="font-medium text-gray-700">Competitors:</strong> {", ".join(competition.get("key_competitors", ["N/A"]))}</p>
                        <p class="text-sm text-gray-600"><strong class="font-medium text-gray-700">Their Focus:</strong> {competition.get("competitor_focus", "N/A")}</p>
                    </div>
                </div>
                <details class="mt-4">
                    <summary class="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">Show/Hide Sources</summary>
                    <ul class="mt-2 pl-4 list-disc text-xs text-gray-500 space-y-1">{sources_html}</ul>
                </details>
            </div>
            """

        supplier_html = ""
        if supplier_data:
            supplier_html += '<div class="border-t-2 border-white bg-gradient-to-br from-'+self.theme+'-50 via-white to-white p-6 rounded-lg shadow-md mb-8 break-inside-avoid">'
            supplier_html += '<h2 class="text-2xl font-bold text-gray-800 mb-4">Potential Supplier Discovery</h2>'
            supplier_html += '<p class="text-gray-600 mb-6">The following potential B2B suppliers were identified for high-opportunity products. Further vetting is required.</p>'
            supplier_html += '<ul class="space-y-4">'
            for product, suppliers in supplier_data.items():
                supplier_links = ", ".join([f'<a href="{s["url"]}" target="_blank" class="text-blue-600 hover:underline">{s["name"]}</a>' for s in suppliers])
                supplier_html += f'<li><strong class="font-medium text-gray-800">{product}:</strong> {supplier_links}</li>'
            supplier_html += "</ul></div>"

        final_report_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Purchasing Intelligence Report</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://rsms.me/inter/inter.css');
                html {{ font-family: 'Inter', sans-serif; }}
                body {{ background-color: #f3f4f6; }}
                *:-webkit-scrollbar {{ display: none; }}
                * {{ -ms-overflow-style: none; scrollbar-width: none; }}
            </style>
        </head>
        <body class="p-4 sm:p-6 md:p-8">
            <div class="max-w-7xl mx-auto">
                <header class="mb-8">
                    <h1 class="text-4xl font-extrabold text-gray-800">Purchasing Intelligence Report</h1>
                    <p class="text-lg text-gray-500">Date: {datetime.now().strftime("%B %d, %Y")}</p>
                    <p class="text-sm text-gray-500">Prepared by: Autonomous Intelligence Agency for {JURISDICTION}</p>
                </header>
                <div class="mb-8 border-t-2 border-white bg-gradient-to-br from-{self.theme}-50 to-white rounded-lg bg-white p-6 shadow-md">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Executive Summary</h2>
                    <div class="prose max-w-none text-gray-700">{executive_summary}</div>
                </div>
                <main class="columns-1 md:columns-2 gap-8">
                    {supplier_html}
                    {report_sections_html}
                </main>
                <footer class="text-center mt-12 text-sm text-gray-500">
                    <p>This report was generated automatically. All findings should be independently verified before making purchasing decisions.</p>
                </footer>
            </div>
        </body>
        </html>
        """
        return final_report_html


class Orchestrator:
    def __init__(self, theme):
        print("--- Initializing AI Agency ---")
        self.llm = GeminiLLM(api_url=GEMINI_API_URL)
        self.search_tool = WebSearchTool()
        self.social_tool = SocialMediaSearchTool()
        self.scraper_tool = WebScraperTool()
        self.market_agent = MarketResearchAgent(self.llm, self.search_tool, self.social_tool, self.scraper_tool)
        self.regulatory_agent = RegulatoryComplianceAgent(self.llm, self.search_tool, self.scraper_tool)
        self.competition_agent = CompetitiveIntelligenceAgent(self.llm, self.search_tool, self.scraper_tool)
        self.supplier_agent = SupplierDiscoveryAgent(self.llm, self.search_tool)
        self.reporting_agent = ReportingAgent(self.llm, theme=theme)

    def run(self):
        yield {"type": "orchestrator_start", "phase": "WORKFLOW_START", "message": "Starting Daily Intelligence Workflow"}
        all_category_data = []

        for category in PRODUCT_CATEGORIES:
            try:
                yield {"type": "progress", "phase": "CATEGORY_START", "message": f"Starting to process category: {category}", "details": {"category": category}}

                market_result = self.market_agent.research_category(category)
                compliance_result = self.regulatory_agent.check_compliance(category, JURISDICTION)
                competition_result = self.competition_agent.analyze_competitors(category)

                market_analysis = market_result.get("analysis", {})
                compliance_analysis = compliance_result.get("analysis", {})
                competition_analysis = competition_result.get("analysis", {})

                # if "error" in market_analysis or "error" in compliance_analysis or "error" in competition_analysis:
                #     yield {"type": "warning", "phase": "CATEGORY_SKIP", "message": f"Skipping report generation for '{category}' due to data gathering or analysis errors.", "details": {"category": category}}
                #     continue

                yield {"type": "progress", "phase": "SCORE_CALCULATION", "message": f"Calculating opportunity score for: {category}", "details": {"category": category}}
                opportunity_score = self.reporting_agent._calculate_opportunity_score(market_analysis, compliance_analysis)

                all_category_data.append({"category": category, "market_data": market_result, "compliance_data": compliance_result, "competition_data": competition_result, "opportunity_score": opportunity_score})
            except Exception as e:
                yield {"type": "error", "phase": "CATEGORY_FAILURE", "message": f"A critical error occurred while processing category '{category}'.", "details": {"category": category, "error": str(e)}}
                yield {"type": "error_detail", "phase": "CATEGORY_FAILURE", "message": "Traceback for critical error.", "details": {"traceback": traceback.format_exc()}}

        if not all_category_data:
            yield {"type": "orchestrator_end", "phase": "WORKFLOW_FAILURE", "message": "Could not gather sufficient data to generate a report."}
            return

        sorted_by_score = sorted(all_category_data, key=lambda x: x["opportunity_score"], reverse=True)
        top_products_to_source = set()
        for item in sorted_by_score:
            if item["opportunity_score"] > 60:
                products = item["market_data"]["analysis"].get("currently_trending_products", [])
                for p in products:
                    top_products_to_source.add(p)
                    if len(top_products_to_source) >= 5:
                        break
            if len(top_products_to_source) >= 5:
                break

        yield {"type": "progress", "phase": "SUPPLIER_DISCOVERY", "message": "Starting supplier discovery for top-ranked products."}
        supplier_data = self.supplier_agent.find_suppliers(list(top_products_to_source))

        yield {"type": "progress", "phase": "REPORT_GENERATION", "message": "Synthesizing all data and generating the final HTML report."}
        final_report = yield from self.reporting_agent.generate_report(all_category_data, supplier_data)

        yield {"type": "orchestrator_end", "phase": "WORKFLOW_COMPLETE", "message": "Report generation complete."}
        yield {"finalReport":final_report, "type": "report", "phase": "FINAL_REPORT", "message": "Final HTML report generated successfully."}
