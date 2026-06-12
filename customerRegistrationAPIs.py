import requests

headers = {
    'Accept': 'application/json, text/plain',
    'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgxMzkzOTk1LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODEyNzM5OTUsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.MhzvSweFxYq8zEQ2cK1a01R6wjsOhY7UXblejtRGMA8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Origin': 'https://erp.101distributorsga.com',
    'Pragma': 'no-cache',
    'Referer': 'https://erp.101distributorsga.com/customer/add',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

json_data = {
    'customerDto': {
        'tier': 1,
        'paymentTermsId': 14,
        'taxable': 1,
        'active': True,
        'saveProductPrice': True,
        'signUpStoreId': 1,
        'countryCode': 1,
        'customerStoreAddressList': [
            {
                'countryId': 1,
                'active': True,
                'defaultAddress': True,
                'billingAddress': True,
                'shippingAddress': True,
                'sameAsBillingAddress': True,
                'address1': 'Address 1',
                'address2': 'Address 2',
                'stateId': 11,
                'state': 'Georgia',
                'cityId': 33070,
                'countyId': 1004,
                'zip': '30033',
                'id': None,
            },
        ],
        'firstName': 'first name',
        'lastName': 'last name',
        'email': 'email@gmail.com',
        'phone': 1234567890,
        'taxId': 'tax-id',
        'feinNumber': 'FEIN-number',
        'cigaretteId': 'Cigarette-id',
        'cigaretteLicenseExpirationDate': '2026-06-30',
        'tobaccoId': 'Tobacco-id',
        'tobaccoLicenseExpirationDate': '2026-06-30',
        'vaporTaxId': 'vapor-tax-id',
        'vaporTaxExpirationDate': '2026-06-30',
        'salesTaxId': 'sales-tax-id',
        'salesTaxIdExpirationDate': '2026-06-30',
        'drivingLicenseNumber': 'driving-license-number',
        'voidCheckNumber': 'bank name',
        'hempLicenseNumber': 'hemp-license-number',
        'hempLicenseExpirationDate': '2026-06-30',
        'company': 'Company Name',
        'dbaName': 'DBA Company Name',
        'customerTypeId': 52,
        'notes': 'Added in 101 Show 2026',
        'primarySalesRepresentativeId': 20,
        'createdBy': 20,
    },
}

response = requests.post('https://erp.101distributorsga.com/api/customer', headers=headers, json=json_data)


'''
response.json(): 

{
    "hasError": false,
    "status": 201,
    "result": {
        "id": 7669,
        "createdBy": 20,
        "insertedTimestamp": "2026-06-12 14:24:51",
        "updatedBy": null,
        "updatedTimestamp": "2026-06-12 14:24:51",
        "parentCustomerId": null,
        "idStr": null,
        "name": null,
        "firstName": "first name",
        "lastName": "last name",
        "company": "Company Name",
        "storeId": 0,
        "customerStoreName": null,
        "email": "email@gmail.com",
        "email1": null,
        "email2": null,
        "phone": "1234567890",
        "phone1": null,
        "phone2": null,
        "storePhone": null,
        "imageUrl": null,
        "gender": null,
        "tier": 1,
        "tierStr": null,
        "authUserLoginId": null,
        "adminId": null,
        "paymentTermsId": 14,
        "paymentTermsName": null,
        "notes": "Added in 101 Show 2026",
        "notes2": null,
        "storeCredit": 0,
        "totalDueBalance": 0,
        "loyaltyPoints": 0,
        "dueAmount": 0,
        "dueAmountStr": null,
        "excessAmount": 0,
        "active": true,
        "verified": false,
        "viewSpecificCategory": false,
        "viewSpecificProduct": false,
        "websiteReference": null,
        "primaryBusiness": null,
        "websiteUrl": null,
        "facebookLink": null,
        "instagramLink": null,
        "referBySalesRep": null,
        "referBySalesRepName": null,
        "primarySalesRepresentativeId": 20,
        "primarySalesRepresentativeIdString": null,
        "secondarySalesRepresentativeId": null,
        "secondarySalesRepresentativeName": null,
        "salesRepresentativeName": null,
        "salesRepresentativePhone": null,
        "salesRepresentativeEmail": null,
        "tobaccoId": "Tobacco-id",
        "taxId": "tax-id",
        "taxable": true,
        "feinNumber": "FEIN-number",
        "tobaccoLicenseExpirationDate": "2026-06-30",
        "vaporTaxId": "vapor-tax-id",
        "vaporTaxExpirationDate": "2026-06-30",
        "referByCustomerId": null,
        "communicateViaPhone": false,
        "communicateViaText": false,
        "password": null,
        "username": null,
        "paymentMethodNonce": null,
        "billingAddress": null,
        "shippingAddress": null,
        "customerStoreAddressList": [
            {
                "id": 7938,
                "customerId": 7669,
                "address1": "Address 1",
                "address2": "Address 2",
                "county": null,
                "stateId": 11,
                "state": "Georgia",
                "city": null,
                "countryId": 1,
                "country": null,
                "zip": "30033",
                "phone": null,
                "billingAddress": true,
                "shippingAddress": true,
                "defaultAddress": true,
                "active": true,
                "cityId": 33070,
                "countyId": 1004
            }
        ],
        "quickbooksCustomerId": null,
        "customerGroupId": null,
        "customerGroupName": null,
        "dbaName": "DBA Company Name",
        "voidCheckNumber": "bank name",
        "drivingLicenseNumber": "driving-license-number",
        "customerTypeId": 52,
        "customerTypeName": null,
        "preferredLanguage": null,
        "achVerified": null,
        "parentCustomerFirstName": null,
        "parentCustomerLastName": null,
        "parentCustomerCompany": null,
        "address1": null,
        "address2": null,
        "city": null,
        "county": null,
        "stateId": 0,
        "state": null,
        "zip": null,
        "country": null,
        "billingAddress1": null,
        "billingAddress2": null,
        "billingCity": null,
        "billingCounty": null,
        "billingStateId": 0,
        "billingState": null,
        "billingZip": null,
        "billingCountry": null,
        "shippingAddress1": null,
        "shippingAddress2": null,
        "shippingCity": null,
        "shippingCounty": null,
        "shippingState": null,
        "shippingZip": null,
        "shippingCountry": null,
        "hempLicenseNumber": "hemp-license-number",
        "hempLicenseExpirationDate": "2026-06-30",
        "primaryBusinessName": null,
        "creditLimit": null,
        "signUpStoreId": 1,
        "signUpStoreName": null,
        "sendDuePaymentReminder": false,
        "customerDocumentList": null,
        "customerPaymentModePreferenceDtoList": null,
        "customerRewardPointDetail": null,
        "rewardable": false,
        "salesTaxId": "sales-tax-id",
        "salesTaxIdExpirationDate": "2026-06-30",
        "saveProductPrice": true,
        "grailPayUuid": null,
        "referByCustomerFirstName": null,
        "referByCustomerLastName": null,
        "referByCustomerCompany": null,
        "autoAch": null,
        "achStartDate": null,
        "cityId": null,
        "countyId": null,
        "cigaretteId": "Cigarette-id",
        "cigaretteLicenseExpirationDate": "2026-06-30",
        "ccnPreferenceNumber": null,
        "crmNote": null,
        "billingAddresss": false,
        "shippingAddresss": false,
        "defaultAddresss": false
    }
}
'''


# get cities by state id
headers = {
    'Accept': 'application/json, text/plain',
    'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgxMzkzOTk1LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODEyNzM5OTUsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.MhzvSweFxYq8zEQ2cK1a01R6wjsOhY7UXblejtRGMA8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Referer': 'https://erp.101distributorsga.com/customer/add',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

response = requests.get('https://erp.101distributorsga.com/api/city/stateId/11', headers=headers)

'''
response.json(): 
{
    "hasError": false,
    "status": 200,
    "result": [
        {
            "id": 33102,
            "stateId": 11,
            "name": "."
        },
        {
            "id": 33182,
            "stateId": 11,
            "name": "0"
        },
        {
            "id": 33240,
            "stateId": 11,
            "name": "00"
        },
        ...
    ]
}
'''

# get counties by state id
headers = {
    'Accept': 'application/json, text/plain',
    'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgxMzkzOTk1LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODEyNzM5OTUsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.MhzvSweFxYq8zEQ2cK1a01R6wjsOhY7UXblejtRGMA8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Referer': 'https://erp.101distributorsga.com/customer/add',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

response = requests.get('https://erp.101distributorsga.com/api/county/stateId/11',  headers=headers)

'''
{
    "hasError": false,
    "status": 200,
    "result": [
        {
            "id": 1820,
            "stateId": 11,
            "name": "Appling"
        },
        {
            "id": 2595,
            "stateId": 11,
            "name": "Atkinson"
        },
        {
            "id": 2126,
            "stateId": 11,
            "name": "Bacon"
        },
        ...
    ]
}
'''

# Document types
'''
{
    "hasError": false,
    "status": 200,
    "result": [
        {
            "id": 60,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "ACH-Form-Document",
            "userAlias": "ACH-Form-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 792,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "ALCOHOLIC BEVERAGE LICENSE ",
            "userAlias": "alcoholic-beverage-license",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 779,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "BANK DETAIL",
            "userAlias": "bank-detail",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 55,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Business-License-Document",
            "userAlias": "Business-License-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 771,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "CARD PAYMENT DETAILS",
            "userAlias": "card-payment-details",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 61,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Credit-Card-Auth-Document",
            "userAlias": "Credit-Card-Auth-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 58,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Driving-License-Document",
            "userAlias": "Driving-License-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 939,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "EXTRA INFO",
            "userAlias": "extra-info",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 56,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "FEIN-License-Document",
            "userAlias": "FEIN-License-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 220,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "HEMP LICENSE",
            "userAlias": "hemp-license",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 790,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "LIQUOR LICENSE ",
            "userAlias": "liquor-license",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 57,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Sales-Tax-Certificate-Document",
            "userAlias": "Sales-Tax-Certificate-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 772,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "THIRD PARTY PAYMENT AUTHORIZATON ",
            "userAlias": "third-party-payment-authorizaton",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 54,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Tobacco-License-Document",
            "userAlias": "Tobacco-License-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 791,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "VENDOR LICENSE",
            "userAlias": "vendor-license",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        },
        {
            "id": 59,
            "fieldId": 651,
            "parentDropDownValueId": null,
            "sysName": "Void-Check-Document",
            "userAlias": "Void-Check-Document",
            "sequence": 1,
            "colorCode": null,
            "subStatuses": null,
            "hidden": false,
            "config": null,
            "accountTypeId": null,
            "childDropDownValueDtoList": null
        }
    ]
}
'''

# document upload
headers = {
    'Accept': 'application/json, text/plain',
    'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgxMzkzOTk1LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODEyNzM5OTUsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.MhzvSweFxYq8zEQ2cK1a01R6wjsOhY7UXblejtRGMA8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryG5BxeBQbFVOdtAkd',
    'Origin': 'https://erp.101distributorsga.com',
    'Pragma': 'no-cache',
    'Referer': 'https://erp.101distributorsga.com/customer/7669/edit',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

files = {
    'attachmentObj': (None, '{"name":"New Project.png","recordId":7669,"moduleId":4,"fieldName":"customer_document","fieldId":651,"active":true,"documentTypeId":60}'),
    'file': ('New-Project1781274750076.png', '', 'image/png'),
}

response = requests.post('https://erp.101distributorsga.com/api/attachment', headers=headers, files=files)

'''
{
    "hasError": false,
    "status": 201,
    "result": {
        "id": 108126,
        "createdBy": 20,
        "insertedTimestamp": "2026-06-12 14:32:31",
        "updatedBy": null,
        "updatedTimestamp": "2026-06-12 14:32:31",
        "name": "New Project.png",
        "recordId": 7669,
        "moduleId": 4,
        "moduleName": null,
        "fieldId": 651,
        "fieldName": null,
        "url": "https://d2p2lri02rh20e.cloudfront.net/101distributorsga/customers/New-Project17812747500762026-06-12-14-32-31Ouxsr.png",
        "documentTypeId": 60,
        "configUrlId": null,
        "redirectPath": null,
        "sequence": 0,
        "size": 635969,
        "active": true,
        "configTypeId": 0,
        "imageConfigUrl": null,
        "config": null,
        "createdByCustomer": null,
        "publicDoc": false
    }
}
'''

# document assignment
headers = {
    'Accept': 'application/json, text/plain',
    'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgxMzkzOTk1LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODEyNzM5OTUsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.MhzvSweFxYq8zEQ2cK1a01R6wjsOhY7UXblejtRGMA8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Referer': 'https://erp.101distributorsga.com/customer/7669/edit',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
}

response = requests.get(
    'https://erp.101distributorsga.com/api/attachment/fieldId/651/recordId/7669/moduleId/4',
    headers=headers,
)

'''
{
    "hasError": false,
    "status": 200,
    "result": [
        {
            "id": 108126,
            "createdBy": null,
            "insertedTimestamp": null,
            "updatedBy": null,
            "updatedTimestamp": null,
            "name": "New Project.png",
            "recordId": 7669,
            "moduleId": 4,
            "moduleName": null,
            "fieldId": 651,
            "fieldName": null,
            "url": "https://d2p2lri02rh20e.cloudfront.net/101distributorsga/customers/New-Project17812747500762026-06-12-14-32-31Ouxsr.png",
            "documentTypeId": 60,
            "configUrlId": null,
            "redirectPath": null,
            "sequence": 0,
            "size": 635969,
            "active": false,
            "configTypeId": 0,
            "imageConfigUrl": null,
            "config": null,
            "createdByCustomer": null,
            "publicDoc": false
        }
    ]
}
'''