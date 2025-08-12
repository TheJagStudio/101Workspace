import React, { useState, useEffect } from 'react'
import CustomDropdown from "../../../Components/utils/CustomDropdown";
import { apiRequest } from '../../../utils/api';

const HotProduct = () => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [currentMasterCategory, setCurrentMasterCategory] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentSubCategory, setCurrentSubCategory] = useState(null);

  // Table and pagination state
  const [tableData, setTableData] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await apiRequest(`${import.meta.env.VITE_SERVER_URL}/api/purchase/categories/`, {
          method: "GET",
          headers: {
            'Content-Type': 'application/json',
          },
        });
        setCategories(response.data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch hot products
  const getData = async () => {
    const categoryId = currentSubCategory || currentCategory || currentMasterCategory;
    setLoading(true);
    try {
      const response = await apiRequest(
        `${import.meta.env.VITE_SERVER_URL}/api/purchase/hot-product/?categoryId=${categoryId ? categoryId : ''}&page=${page}&page_size=${pageSize}`,
        {
          method: "GET",
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      setTableData(response.products || []);
      setTotalPages(response.totalPages || 1);
      if (response.products?.length === 0 && page > 1) {
        setPage(1);
      }
    } catch (error) {
      console.error('Error fetching hot products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when page/pageSize changes
  useEffect(() => {
    getData();
    // eslint-disable-next-line
  }, [page, pageSize]);

  return (
    <div>
      <p className="text-3xl font-semibold text-gray-700">Hot Products</p>
      <div className={"bg-white select-none w-full h-fit rounded-lg shadow-md mt-5 p-4 items-end justify-start flex flex-row flex-wrap gap-x-4 gap-y-1" + (loading ? " opacity-50 pointer-events-none" : "")}>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">Master Categories</label>
          <CustomDropdown
            options={categories.map((category) => ({
              value: category?.categoryId,
              label: category?.name
            }))}
            value={currentMasterCategory}
            onChange={setCurrentMasterCategory}
            placeholder="master category"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">Categories</label>
          <CustomDropdown
            options={
              currentMasterCategory
                ? (categories.find(cat => cat.categoryId === currentMasterCategory)?.subcategories || []).map((subcategory) => ({
                  value: subcategory?.categoryId,
                  label: subcategory?.name
                }))
                : []
            }
            value={currentCategory}
            onChange={setCurrentCategory}
            placeholder="Category"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">Sub Categories</label>
          <CustomDropdown
            options={
              currentCategory
                ? (
                  categories.find(cat => cat.categoryId === currentMasterCategory)?.subcategories?.find(sub => sub.categoryId === currentCategory)
                    ?.subcategories || []
                ).map(subsubcategory => ({
                  value: subsubcategory?.categoryId,
                  label: subsubcategory?.name
                }))
                : []
            }
            value={currentSubCategory}
            onChange={setCurrentSubCategory}
            placeholder="Sub Category"
          />
        </div>
        <button
          onClick={getData}
          className="bg-indigo-500 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 cursor-pointer"
        >
          Search
        </button>
      </div>

      {/* Table Section */}
      <div className={"mt-5 relative bg-white border-t border-gray-300 w-full h-fit rounded-lg shadow-md overflow-hidden text-gray-700 transition-all duration-500"}>
        {loading && (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white/25 backdrop-blur-md z-20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width={60} height={60} className="mx-auto animate-spin">
              <circle strokeDasharray="197.92033717615698 67.97344572538566" r={42} strokeWidth={13} stroke="#615fff" fill="none" cy={50} cx={50} />
            </svg>
          </div>
        )}
        <div className="h-fit min-h-32 max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className={"w-full " + (loading ? "opacity-50 pointer-events-none" : "")}>
            <thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
              <tr className="border-b border-gray-300 bg-gray-100 leading-4">
                <th className="text-center py-4 px-1">SR</th>
                <th className="text-left p-4 border-l border-gray-300">Product</th>
                <th className="text-center p-4 border-l border-gray-300">UPC</th>
                <th className="text-center p-4 border-l border-gray-300">SKU</th>
                <th className="text-center p-4 border-l border-gray-300">Quantity</th>
                <th className="text-center p-4 border-l border-gray-300">Cost Price</th>
                <th className="text-center p-4 border-l border-gray-300">Retail Price</th>
                <th className="text-center p-4 border-l border-gray-300">Category</th>
              </tr>
            </thead>
            <tbody className="overflow-y-auto">
              {tableData?.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? "" : "bg-gray-100"}>
                  <td className="py-2 px-1 w-fit text-center">{(page - 1) * pageSize + index + 1}</td>
                  <td className="py-0 px-2 border-l border-gray-300 w-[40%]">
                    <div className="flex items-center ">
                      <img
                        src={item.imageUrl || "/static/images/default.png"}
                        alt={item.name}
                        className="w-8 h-8 mr-2 mix-blend-multiply"
                      />
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://erp.101distributorsga.com/product/${item.id}/edit`}
                        className="text-blue-600 px-2 whitespace-nowrap hover:italic hover:underline cursor-pointer"
                      >
                        ({item.id})
                      </a>
                      <span className="truncate text-sm flex items-center whitespace-break-spaces h-12 overflow-ellipsis">{item.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center border-l border-gray-300">{item.upc || "-"}</td>
                  <td className="py-2 px-2 text-center border-l border-gray-300">{item.sku || "-"}</td>
                  <td className="py-2 px-2 text-center border-l border-gray-300">{item.quantity ?? "-"}</td>
                  <td className="py-2 px-2 text-center border-l border-gray-300">{item.costPrice != null ? `$${item.costPrice.toFixed(2)}` : "-"}</td>
                  <td className="py-2 px-2 text-center border-l border-gray-300">{item.retailPrice != null ? `$${item.retailPrice.toFixed(2)}` : "-"}</td>
                  <td className="py-2 px-2 text-center border-l border-gray-300 max-w-64 whitespace-nowrap hover:whitespace-break-spaces overflow-ellipsis truncate hover:h-fit">{item.category?.join(", ")}</td>
                </tr>
              ))}
              {tableData?.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-gray-500">No data available. First select a category and search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination Section */}
      {tableData?.length > 0 && !loading && (
        <div className="flex items-center justify-between mt-5 gap-5">
          <div className="bg-white w-fit h-fit rounded-lg shadow-lg ml-auto">
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(page > 1 ? page - 1 : 1)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                  <svg width={20} height={20} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" stroke="currentColor" strokeWidth={75} d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8z" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button onClick={() => setPage(page < totalPages ? page + 1 : totalPages)} className="p-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                  <svg width={20} height={20} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="rotate-180">
                    <path fill="currentColor" stroke="currentColor" strokeWidth={75} d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white w-fit h-fit rounded-lg shadow-lg p-2 flex items-center">
            <label className="text-sm text-gray-600 mr-2">Page Size:</label>
            <CustomDropdown
              options={[
                { value: 10, label: "10" },
                { value: 20, label: "20" },
                { value: 50, label: "50" },
                { value: 100, label: "100" },
                { value: 500, label: "500" },
              ]}
              optionUp={true}
              value={pageSize}
              onChange={setPageSize}
              placeholder="Page Size"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default HotProduct