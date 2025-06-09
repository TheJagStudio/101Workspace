import { useEffect, useRef, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/esm/styles/hljs";
import TableGrid from "./TableGrid";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import mermaid from 'mermaid';

const generateMermaidId = () => `mermaid-graph-${Math.random().toString(36).substring(2, 15)}`;


const Chatbot = () => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const chatContainerRef = useRef(null);

	useEffect(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
		}
	}, [messages]);

	const sendMessage = async () => {
		if (!inputMessage.trim()) return;

		const userMessage = { sender: "user", text: inputMessage };
		setMessages((prevMessages) => [...prevMessages, userMessage]);
		setInputMessage("");
		setIsLoading(true); // Show loading indicator

		try {
			const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/chat-with-ai-agent/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ query: userMessage.text }),
			});

			const data = await response.json();

			if (response.ok) {
				setMessages((prevMessages) => [...prevMessages, { sender: "agent", data: data.response }]);
			} else {
				// Handle API errors
				setMessages((prevMessages) => [...prevMessages, { sender: "agent", data: `Error: ${data.error || "Something went wrong."}` }]);
			}
		} catch (error) {
			// Handle network errors
			setMessages((prevMessages) => [...prevMessages, { sender: "agent", data: `Network Error: ${error.message}` }]);
		} finally {
			setIsLoading(false); // Hide loading indicator
		}
	};
	const CodeBlockCustom = ({ code }) => {
		const [showCode, setShowCode] = useState(true);

		const toggleCodeVisibility = () => {
			setShowCode(!showCode);
		};
		return (
			<div className="relative max-w-[70%]">
				<SyntaxHighlighter language="python" style={vs} wrapLines={true} lineProps={{ style: { wordBreak: "break-all", whiteSpace: "pre-wrap" } }} className={`transition-all duration-300 ${showCode ? "h-auto w-auto" : "h-0 w-0 overflow-hidden"}`}>
					{code}
				</SyntaxHighlighter>
				<div
					onClick={() => {
						toggleCodeVisibility();
					}}
					className={"absolute text-nowrap bg-green-200 text-gray-800 px-2 py-1 rounded-bl-lg rounded-tr-lg text-xs font-semibold top-0 cursor-pointer transition-all " + (showCode ? "right-0" : "right-full translate-x-full")}
				>
					{showCode ? "Hide" : "Show"} Generated Python Code
				</div>
			</div>
		);
	};

	useEffect(() => {
		mermaid.initialize({ startOnLoad: false, theme: 'light' }); 
	}, []);
	return (
		<>
			{!isChatOpen && (
				<button onClick={() => setIsChatOpen(true)} className="fixed bottom-8 right-8 group cursor-pointer text-white border-b border-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 hover:shadow-indigo-200 focus:outline-none transition-all duration-300 z-50" aria-label="Open chat">
					<img src="/static/images/chatbot.png" alt="Chat Icon" className="w-14 h-14 bg-[#eceef1] group-hover:-rotate-12 transition-all p-2 rounded-full border-t border-white" />
				</button>
			)}

			{/* Chat Popup Modal */}
			{isChatOpen && (
				<div className="absolute top-0 left-0 h-[calc(100vh-4rem)] w-full inset-0 bg-black/20 backdrop-blur bg-opacity-50 flex items-center justify-center z-30 p-4">
					<div onClick={() => {
						setIsChatOpen(false);
					}} className="h-full w-full absolute"></div>
					<div className="bg-gradient-to-tr from-blue-50 via-white to-orange-50 rounded-xl shadow-2xl border border-dashed border-gray-300 p-6 w-full max-w-5xl flex flex-col h-[90vh] md:h-[80vh] relative">
						{/* Close Button */}
						<button onClick={() => setIsChatOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 cursor-pointer text-2xl font-bold focus:outline-none" aria-label="Close chat">
							&times;
						</button>

						<h1 className="text-3xl font-bold text-left leading-0 text-indigo-600 mb-6 mt-4">101 AI Assistant</h1>

						{/* Chat Messages Display Area */}
						<div ref={chatContainerRef} className="flex-1 overflow-y-auto border border-gray-300 rounded-lg p-4 mb-4 bg-white scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
							{messages.length === 0 ? (
								<div className="text-center text-gray-500 italic mt-10">Type a question to get started!</div>
							) : (
								messages.map((msg, index) => {
									let pythonCode = "";
									let queryResult = [];
									let isLoaded = false;
									if (msg.sender !== "user") {
										try {
											pythonCode = msg.data.python_code;
											queryResult = msg.data.results;
											try {
												queryResult = JSON.parse(queryResult);
												isLoaded = true;
											} catch (error) {
												console.error("Error parsing query result:", error);
											}
											// check if the query result is an array
											if (Array.isArray(queryResult)) {
												isLoaded = true;
												// check if the first element of the array is an object and if not isLoaded = false;
												if (queryResult.length > 0 && typeof queryResult[0] !== "object") {
													isLoaded = false;
												}
											} else {
												isLoaded = false;
											}
											return (
												<div key={index} className={`flex flex-col gap-2 mb-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
													{pythonCode !== null && <CodeBlockCustom code={pythonCode} />}
													{!isLoaded && msg.sender !== "user" && <div className={`max-w-[50%] w-fit px-4 py-2 rounded-lg shadow-inner text-wrap wrap-break-word  ${msg.sender === "user" ? "bg-indigo-500 text-white rounded-br-none" : "bg-green-200 text-gray-800 rounded-bl-none"}`} dangerouslySetInnerHTML={{ __html: msg?.data?.natural_language_response }}></div>}
													{/* create a table using json data */}
													{isLoaded && (
														<div className="w-full text-wrap wrap-break-word ">
															<TableGrid data={queryResult} />
														</div>
													)}
												</div>
											);
										} catch (error) {
											console.error("Error processing message:", error);
											return (
												<div className="flex justify-start mb-3">
													<div className="max-w-[70%] px-4 py-2 rounded-lg shadow-inner bg-gray-200 text-gray-700 rounded-bl-none">{error.message}</div>
												</div>
											);
										}
									} else {
										return <div className="flex justify-start mb-3">{msg.sender === "user" && <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow-md text-wrap wrap-break-word ${msg.sender === "user" ? "bg-indigo-500 text-white rounded-br-none ml-auto" : "bg-gray-200 text-gray-800 rounded-bl-none"}`}>{msg.text}</div>}</div>;
									}
								})
							)}
							{isLoading && (
								<div className="flex justify-start mb-3">
									<div className="max-w-[70%] px-4 py-2 rounded-lg shadow-inner bg-gray-200 text-gray-700 rounded-bl-none animate-pulse">Thinking...</div>
								</div>
							)}
						</div>

						{/* Message Input and Send Button */}
						<div className="flex items-center">
							<input
								className="flex-1 resize-none border border-gray-300 bg-white rounded-lg p-3 mr-3 focus:outline-none focus:border-indigo-500 border-dashed text-gray-800"
								rows="3"
								placeholder="Ask your question about the database..."
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								onKeyPress={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault(); // Prevent new line
										sendMessage();
									}
								}}
								disabled={isLoading}
							></input>
							<button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} className="px-3 py-3 flex flex-row gap-2 bg-gradient-to-br from-indigo-600 to-indigo-400 text-white font-semibold rounded-lg border-t-0 border border-b-2 border-indigo-300 shadow-md hover:to-indigo-600 hover:from-indigo-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
								<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="h-5 w-5 ">
									<path className="path-custom" strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="currentColor" d="M14.187 8.096 15 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L21.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09L15 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L8.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09zM6 14.25l-.259 1.035a3.38 3.38 0 0 1-2.456 2.456L2.25 18l1.035.259a3.38 3.38 0 0 1 2.456 2.456L6 21.75l.259-1.035a3.38 3.38 0 0 1 2.455-2.456L9.75 18l-1.036-.259a3.38 3.38 0 0 1-2.455-2.456zM6.5 4l-.197.591a1.13 1.13 0 0 1-.711.712L5 5.5l.591.197a1.13 1.13 0 0 1 .712.712L6.5 7l.197-.591a1.13 1.13 0 0 1 .712-.712L8 5.5l-.591-.197a1.13 1.13 0 0 1-.712-.711z" />
								</svg>
								{isLoading ? "Sending..." : "Send"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default Chatbot;
