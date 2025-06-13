import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { errorsAtom, warningsAtom, successAtom, infoAtom } from '../../Variables';

const Notification = () => {
	const [errors, setErrors] = useAtom(errorsAtom);
	const [warnings, setWarnings] = useAtom(warningsAtom);
	const [success, setSuccess] = useAtom(successAtom);
	const [info, setInfo] = useAtom(infoAtom);

	// Clear an error after 5 seconds
	const removeError = (id) => {
		document.getElementById(`error-${id}`)?.classList.add('animate-slideOut');
		setTimeout(() => {
			setErrors(prev => prev.filter(error => error?.id !== id));
		}, 300);
	};
	const removeWarning = (id) => {
		document.getElementById(`warning-${id}`)?.classList.add('animate-slideOut');
		setTimeout(() => {
			setWarnings(prev => prev.filter(warning => warning?.id !== id));
		}, 300);
	};

	const removeSuccess = (id) => {
		document.getElementById(`success-${id}`)?.classList.add('animate-slideOut');
		setTimeout(() => {
			setSuccess(prev => prev.filter(suc => suc?.id !== id));
		}, 300);
	};
	const removeInfo = (id) => {
		document.getElementById(`info-${id}`)?.classList.add('animate-slideOut');
		setTimeout(() => {
			setInfo(prev => prev.filter(inf => inf?.id !== id));
		}, 300);
	};

	useEffect(() => {
		const timeouts = errors.map(error => {
			if (error?.id) {
				return setTimeout(() => removeError(error.id), 5000);
			}
			return null;
		}).filter(Boolean);

		return () => {
			timeouts.forEach(timeoutId => clearTimeout(timeoutId));
		};
	}, [errors]);

	useEffect(() => {
		const timeouts = warnings.map(warning => {
			if (warning?.id) {
				return setTimeout(() => removeWarning(warning.id), 5000);
			}
			return null;
		}).filter(Boolean);
		return () => {
			timeouts.forEach(timeoutId => clearTimeout(timeoutId));
		};
	}, [warnings]);

	useEffect(() => {
		const timeouts = success.map(suc => {
			if (suc?.id) {
				return setTimeout(() => removeSuccess(suc.id), 5000);
			}
			return null;
		}
		).filter(Boolean);
		return () => {
			timeouts.forEach(timeoutId => clearTimeout(timeoutId));
		};
	}, [success]);

	useEffect(() => {
		const timeouts = info.map(inf => {
			if (inf?.id) {
				return setTimeout(() => removeInfo(inf.id), 5000);
			}
			return null;
		}).filter(Boolean);
		return () => {
			timeouts.forEach(timeoutId => clearTimeout(timeoutId));
		};
	}, [info]);

	return (
		<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2.5 ">
			{errors.map(error => (
				<div key={error?.id} id={`error-${error?.id}`} className="bg-red-100/50 backdrop-blur-3xl text-red-700 border border-l-4 border-red-500 py-1 px-4 rounded-xl shadow shadow-red-500/25 flex items-center justify-between min-w-[300px] animate-slideIn">
					<div className="flex flex-col">
						{error?.message}
						{/* {error?.status && <span className="text-xs opacity-80">Status: {error?.status}</span>} */}
					</div>
					<button onClick={() => {
						removeError(error?.id);
					}} className="bg-transparent border-none text-red-700 text-xl cursor-pointer ml-2.5 px-1.5 hover:opacity-70">
						×
					</button>
				</div>
			))}

			{warnings.map(warning => (
				<div key={warning?.id} id={`warning-${warning?.id}`} className="bg-yellow-100/50 backdrop-blur-3xl text-yellow-700 border border-l-4 border-yellow-500 py-1 px-4 rounded-xl shadow shadow-yellow-500/25 flex items-center justify-between min-w-[300px] animate-slideIn">
					<div className="flex flex-col">
						{warning?.message}
					</div>
					<button onClick={() => {
						removeWarning(warning?.id);
					}} className="bg-transparent border-none text-yellow-700 text-xl cursor-pointer ml-2.5 px-1.5 hover:opacity-70">
						×
					</button>
				</div>
			))}

			{success.map(success => (
				<div key={success?.id} id={`success-${success?.id}`} className="bg-green-100/50 backdrop-blur-3xl text-green-700 border border-l-4 border-green-500 py-1 px-4 rounded-xl shadow shadow-green-500/25 flex items-center justify-between min-w-[300px] animate-slideIn">
					<div className="flex flex-col">
						{success?.message}
					</div>
					<button onClick={() => {
						removeSuccess(success?.id);
					}} className="bg-transparent border-none text-green-700 text-xl cursor-pointer ml-2.5 px-1.5 hover:opacity-70">
						×
					</button>
				</div>
			))}

			{info.map(inf => (
				<div key={inf?.id} id={`info-${inf?.id}`} className="bg-blue-100/50 backdrop-blur-3xl text-blue-700 border border-l-4 border-blue-500 py-1 px-4 rounded-xl shadow shadow-blue-500/25 flex items-center justify-between min-w-[300px] animate-slideIn">
					<div className="flex flex-col">
						{inf?.message}
					</div>
					<button onClick={() => {
						removeInfo(inf?.id);
					}} className="bg-transparent border-none text-blue-700 text-xl cursor-pointer ml-2.5 px-1.5 hover:opacity-70">
						×
					</button>
				</div>
			))}
		</div>
	);
};

export default Notification;