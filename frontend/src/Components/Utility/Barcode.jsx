import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import JsBarcode from 'jsbarcode';
import '../../Pages/Utility/Sticker.css'; 

const Barcode = ({ value }) => {
    const barcodeRef = useRef(null);

    useEffect(() => {
        if (!barcodeRef.current || !value) return;

        try {
            // Clean the value to ensure only valid characters
            const cleanValue = value.toString().replace(/[^\w\d]/g, '');
            
            JsBarcode(barcodeRef.current, cleanValue, {
                format: "CODE128",
                textMargin: 0,
                displayValue: false,
                fontOptions: 'bold',
                width: 2,
                height: 50,
                marginLeft: 0,
                marginRight: 0,
                valid: (valid) => {
                    if (!valid) {
                        throw new Error('Invalid barcode value');
                    }
                }
            });
        } catch (e) {
            console.error('Barcode generation error:', e);
            if (barcodeRef.current) {
                barcodeRef.current.style.display = 'none';
            }
        }
    }, [value]);

    return <svg ref={barcodeRef} className="barcode"></svg>;
};

Barcode.propTypes = {
    value: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]).isRequired
};

export default Barcode;