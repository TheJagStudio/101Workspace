import React, { useState, useEffect } from 'react'
import CustomDropdown from "../../../Components/utils/CustomDropdown"
import { apiRequest } from "../../../utils/api"
import { useAtom } from "jotai"
import { successAtom } from '../../../Variables'

const typeOptions = [
    { value: "category", label: "Category" },
    { value: "product", label: "Product" }
];

const periodOptions = [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "3month", label: "3 Month" },
    { value: "6month", label: "6 Month" },
    { value: "year", label: "Year" }
];

// Helper: Convert flat category list to tree
function buildCategoryTree(categories) {
    const map = {};
    categories.forEach(cat => {
        map[cat?.categoryId] = { ...cat, children: [] };
    });
    // Sort parents alphabetically by name
    const parents = categories.filter(cat => !cat?.parentId);
    parents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const tree = [];
    categories.forEach(cat => {
        if (cat?.parentId && map[cat?.parentId]) {
            map[cat?.parentId].children.push(map[cat?.categoryId]);
        }
    });
    parents.forEach(parent => {
        tree.push(map[parent.categoryId]);
    });
    return tree;
}

// Helper: Recursively update parValueDays for all children
function updateChildrenParValue(node, value) {
    node.parValueDays = value;
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => updateChildrenParValue(child, value));
    }
}

// CategoryParLevelTree component (collapsible, input right, parent change propagates)
const CategoryParLevelTree = ({
    categories,
    parValues,
    onParValueChange,
    collapsedMap,
    setCollapsedMap
}) => {
    const handleCollapseToggle = (categoryId) => {
        setCollapsedMap(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }));
    };

    const renderTree = (nodes, level = 0) => (
        <ul className={(level === 0 ? "pl-0" : "pl-8") + " mt-2"}>
            {nodes.map(node => (
                <li key={node.categoryId} className="mb-2">
                    <div className="flex items-center gap-2">
                        {node.children && node.children.length > 0 && (
                            <button
                                type="button"
                                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-indigo-600"
                                onClick={() => handleCollapseToggle(node.categoryId)}
                                tabIndex={-1}
                            >
                                {collapsedMap[node.categoryId] ? (
                                    <span>&#9654;</span>
                                ) : (
                                    <span>&#9660;</span>
                                )}
                            </button>
                        )}
                        <span className="font-medium">{node.name}</span>
                        {/* add a ---  between name and input */}
                        <span className="mx-2 border-b border-dashed border-gray-400 flex-1"></span>
                        <input
                            type="number"
                            value={parValues[node.categoryId] ?? ""}
                            min={0}
                            className="border border-gray-300 bg-white px-2 py-1 rounded w-20 ml-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onChange={e => onParValueChange(node.categoryId, e.target.value, node)}
                        />
                    </div>
                    {node.children && node.children.length > 0 && !collapsedMap[node.categoryId] && renderTree(node.children, level + 1)}
                </li>
            ))}
        </ul>
    );
    return renderTree(categories);
};

// Table for changed entries
const ChangedEntriesTable = ({ changedEntries }) => (
    <div className="bg-white rounded-lg shadow-md p-4">
        <p className="font-semibold text-lg mb-2">Changed Categories</p>
        <div className='max-h-96 overflow-y-auto relative'>
              <table className="w-full border border-gray-300 rounded-lg shadow-inner overflow-hidden ">
                  <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2">Category ID</th>
                        <th className="text-left px-2 py-2">Name</th>
                        <th className="text-center px-2 py-2">Par Value (Days)</th>
                    </tr>
                </thead>
                <tbody>
                    {changedEntries.length > 0 ? changedEntries.map(cat => (
                        <tr key={cat?.categoryId} className="border-t border-gray-300">
                            <td className="px-2 py-2">{cat?.categoryId}</td>
                            <td className="px-2 py-2">{cat?.name}</td>
                            <td className="px-2 py-2 text-center">{cat?.parValueDays}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={3} className="text-center py-4 text-gray-400">No changes yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const ParLevel = () => {
    const [type, setType] = useState("category");
    const [period, setPeriod] = useState("month");
    const [categoryData, setCategoryData] = useState([]);
    const [parValues, setParValues] = useState({});
    const [collapsedMap, setCollapsedMap] = useState({});
    const [changedEntries, setChangedEntries] = useState([]);
    const [successMessage, setSuccessMessage] = useAtom(successAtom);

    // Fetch category par levels
    useEffect(() => {
        if (type === "category") {
            apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/?dataType=category`)
                .then(res => {
                    setCategoryData(res.data || []);
                    // Initialize parValues state
                    const initial = {};
                    (res.data || []).forEach(cat => {
                        initial[cat?.categoryId] = cat?.parValueDays ?? "";
                    });
                    setParValues(initial);
                    // Initialize all categories as collapsed by default
                    const collapsedInitial = {};
                    (res.data || []).forEach(cat => {
                        collapsedInitial[cat?.categoryId] = true;
                    });
                    setCollapsedMap(collapsedInitial);
                    setChangedEntries([]);
                });
        }
    }, [type]);

    // Handler for parValueDays input change (parent change propagates to children)
    const handleParValueChange = (categoryId, value, node) => {
        value = value === "" ? "" : Number(value);
        // Build tree from flat list for propagation
        const tree = buildCategoryTree(
            categoryData.map(cat => ({
                ...cat,
                parValueDays: parValues[cat?.categoryId]
            }))
        );
        // Find node in tree
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.categoryId === categoryId) return n;
                if (n.children && n.children.length > 0) {
                    const found = findNode(n.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const targetNode = findNode(tree);
        if (targetNode) {
            updateChildrenParValue(targetNode, value);
            // Update parValues for all affected nodes
            const updatedParValues = { ...parValues };
            const collectIds = (n) => {
                updatedParValues[n.categoryId] = value;
                if (n.children && n.children.length > 0) {
                    n.children.forEach(collectIds);
                }
            };
            collectIds(targetNode);

            setParValues(updatedParValues);

            // Update changedEntries
            const changed = [];
            Object.keys(updatedParValues).forEach(id => {
                const orig = categoryData.find(cat => cat?.categoryId === Number(id));
                if (orig && String(orig.parValueDays) !== String(updatedParValues[id])) {
                    changed.push({
                        categoryId: orig.categoryId,
                        name: orig.name,
                        parValueDays: updatedParValues[id]
                    });
                }
            });
            setChangedEntries(changed);
        }
    };

    // Build tree from flat category list
    const categoryTree = buildCategoryTree(
        categoryData.map(cat => ({
            ...cat,
            parValueDays: parValues[cat?.categoryId]
        }))
    );

    // Submit handler
    const handleSubmit = async () => {
        let response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/par-level/`, { method: 'POST', body: JSON.stringify({ changes: changedEntries,dataType:"category" }) })
        setChangedEntries([]);
        setSuccessMessage([...successMessage,{"id": Date.now(),"message": response?.message || "Changes saved successfully.","status": response?.status || "success"}]);
    };

    return (
        <div>
            {/* Top Filter Bar */}
            <div className="bg-white w-full h-fit rounded-lg shadow-md mt-2 p-4 flex flex-row gap-4 items-end">
                <div className="flex flex-col">
                    <label className="text-sm text-gray-600 mb-1">Type</label>
                    <CustomDropdown
                        options={typeOptions}
                        value={type}
                        onChange={setType}
                        placeholder="Type"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm text-gray-600 mb-1">Time Period</label>
                    <CustomDropdown
                        options={periodOptions}
                        value={period}
                        onChange={setPeriod}
                        placeholder="Time Period"
                    />
                </div>
            </div>
            {/* Category ParLevel Tree & Changed Entries Table */}
            {type === "category" && (
                <div className="mt-6 flex flex-row gap-8 items-start">
                    <div className="flex-1 max-w-[50%]">
                        <CategoryParLevelTree
                            categories={categoryTree}
                            parValues={parValues}
                            onParValueChange={handleParValueChange}
                            collapsedMap={collapsedMap}
                            setCollapsedMap={setCollapsedMap}
                        />
                    </div>
                    <div className="flex-1 max-w-[50%]">
                        <ChangedEntriesTable changedEntries={changedEntries} />
                        <button
                            className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700"
                            onClick={handleSubmit}
                            disabled={changedEntries.length === 0}
                        >
                            Submit Changes
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ParLevel