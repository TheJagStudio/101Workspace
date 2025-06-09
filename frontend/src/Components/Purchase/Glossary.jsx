import React, { useState } from "react";

const Glossary = ({ setGlossary, glossary }) => {
	const [tab, setTab] = useState(Object.keys(glossary?.tabData)[0]);
	const [measure, setMeasure] = useState(glossary?.tabData[tab]?.measures);

	return (
		<div className="bg-white rounded-lg border border-dashed border-gray-300 shadow-lg w-full h-[60%] overflow-y-scroll max-w-2xl relative text-gray-800">
			<div className="sticky top-0 bg-white p-6 pb-1">
				<svg
					onClick={() => {
						setGlossary({ open: false, tabData: null });
					}}
					width={20}
					height={20}
					viewBox="0 0 16 16"
					xmlns="http://www.w3.org/2000/svg"
					className="absolute top-3 right-2 cursor-pointer text-gray-500 hover:text-red-600"
				>
					<path fillRule="evenodd" fill="currentColor" d="M11.293 3.293a1 1 0 1 1 1.414 1.414L9.414 8l3.293 3.293a1 1 0 0 1-1.414 1.414L8 9.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L6.586 8 3.293 4.707a1 1 0 0 1 1.414-1.414L8 6.586z" />
				</svg>
				<h2 className="text-xl font-semibold mb-4">Glossary of measures</h2>
				<div className="flex border-b border-gray-300 mb-4">
					{Object.keys(glossary?.tabData).map((key) => (
						<button
							key={key}
							onClick={() => {
								setTab(key);
								setMeasure(glossary?.tabData[key].measures);
							}}
							className={`px-4 py-2 focus:outline-none ${tab === key ? "border-b-2 border-indigo-500 text-indigo-600 font-semibold" : "text-gray-700"}`}
						>
							{key.charAt(0).toUpperCase() + key.slice(1)} measures
						</button>
					))}
				</div>
				<div className="mb-2 text-gray-500 text-sm">{glossary?.tabData[tab].tabInfo}</div>
			</div>
			<div className="p-6 pt-0">
				<table className="w-full text-left ">
					<thead>
						<tr>
							<th className="py-2 font-medium">Measure</th>
							<th className="py-2 font-medium">Definition</th>
						</tr>
					</thead>
					<tbody>
						{measure.map((row, idx) => (
							<tr key={idx} className="border-t border-gray-300">
								<td className="py-2 font-semibold whitespace-nowrap pr-5">{row.measure}</td>
								<td className="py-2 text-gray-600">{row.definition}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
export default Glossary;
