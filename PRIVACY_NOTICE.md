# Zhishi Privacy Notice (Pre-Launch Draft)

Last updated: August 15, 2026

> This draft describes the current MVP and a privacy-first production baseline. It is not ready for publication until the controller identity, hosting location, service providers, retention settings, and contact channels are completed and verified against the deployed product.

## 1. Who Controls Your Data

**[Company Legal Name]**, **[registered address]**, is the controller of personal data processed through Zhishi. Privacy contact: **[privacy email]**.

If required, the EU representative, UK representative, and Data Protection Officer details will be listed here before launch.

## 2. Scope

This Privacy Notice applies to Zhishi’s mobile applications, websites, APIs, and support channels. It does not cover third-party services operating under their own privacy notices.

## 3. Data We Process

Depending on the feature used, we may process:

- **Birth and calculation data:** birth date, entered birth time, time-accuracy selection, birth place, latitude, longitude, time zone, traditional luck-direction input, calculation rules, and generated chart results.
- **Reflection data:** journal entries, mood or pressure selections, life-chapter notes, and other content a user chooses to enter.
- **AI interpretation data:** the selected interpretation focus, an optional question, and a minimised package of chart-derived facts such as Four Pillars labels, ten-god labels, current luck/annual/monthly cycles, boundary dates, and time-accuracy information.
- **Technical and security data:** IP address, request time, app and device version, crash information, security events, and diagnostic logs where enabled.
- **Support data:** messages and contact details a user sends to customer support.
- **Account and transaction data:** only if account or paid features are introduced, and only after this Notice is updated.

We receive birth, reflection, and support data directly from the user. A place-search query may be sent to the disclosed geocoding provider to return a time zone and coordinates.

## 4. Current MVP Data Practices

- A chart calculation request is sent to the configured Zhishi calculation API.
- The current API does not intentionally persist calculation request bodies or chart results after returning the response.
- A chart is saved locally on the device only after the user selects “Save,” and remains until the user clears it or removes the application and device storage.
- The current MVP has no advertising SDK, behavioural advertising, account sync, or data-broker integration.
- Zhishi does not sell personal data or share it for cross-context behavioural advertising in the current MVP.
- An AI interpretation is generated only after the user selects the feature and acknowledges the just-in-time notice. Zhishi sends DeepSeek the minimised AI interpretation data described above, not the submitted birth date, birth-place name, latitude, or longitude.
- Zhishi does not intentionally retain the AI request or generated interpretation after returning it. The current mobile app keeps the generated text only in the open page and does not save it automatically.

Production infrastructure and diagnostic logging must be re-audited before this section is published.

## 5. Why We Process Data and Our Legal Bases

For users in the EU, EEA, and UK, the anticipated legal bases are:

| Purpose | Data | Legal basis |
| --- | --- | --- |
| Generate the requested chart and current cycles | Birth and calculation data | Performance of the user-requested service / contract |
| Save or clear a chart on the user’s device | Birth data and chart result | User request and performance of the service |
| Provide journaling or reflection features | Content deliberately entered by the user | Performance of the service; explicit consent if special-category data is intentionally requested |
| Generate an AI-assisted cultural interpretation requested by the user | Minimised chart-derived facts, selected focus, and optional question | Performance of the user-requested service / contract; additional explicit consent if special-category data is intentionally requested |
| Protect the Service, prevent abuse, and diagnose faults | Limited technical and security data | Legitimate interests in security and reliability, balanced against user rights |
| Meet legal obligations and respond to lawful requests | Relevant records | Legal obligation |
| Optional analytics or marketing | Data described at the consent prompt | Consent where required; disabled in the current MVP |

Zhishi will not repurpose birth or reflection data for advertising, Zhishi model training, or unrelated profiling without a new, valid legal basis and clear advance notice. DeepSeek's processing of API inputs and outputs is governed by its separate Open Platform Terms and privacy materials, which currently permit limited de-identified use for service maintenance or improvement. Material changes based on consent will require affirmative permission where applicable.

## 6. Sensitive Data

Birth location, full birth date, and personal reflection entries can be sensitive in context. Zhishi does not treat a traditional chart as a medical diagnosis and does not intentionally infer health status, religion, sexual orientation, or another legally protected characteristic from a chart.

Users should not enter medical records or another person’s sensitive data. If a future feature intentionally processes health data or another special category of personal data, Zhishi will first implement the additional legal basis, consent, safeguards, and notices required in the relevant market.

## 7. Sharing and Service Providers

We may disclose data only as needed to:

- hosting, security, customer-support, and infrastructure providers acting under contract;
- a disclosed geocoding provider when the user performs a place search;
- **Hangzhou DeepSeek Artificial Intelligence Co., Ltd. (DeepSeek):** generation of an expressly requested AI cultural interpretation from minimised chart-derived facts and optional user text;
- payment processors if paid features are introduced;
- professional advisers, acquirers, or successors subject to appropriate confidentiality and legal safeguards; or
- public authorities where disclosure is legally required and proportionate.

A production subprocessor list, including provider names, processing locations, and purposes, must be published before launch. We do not disclose personal data to data brokers.

## 8. Retention

- **One-time chart requests:** calculation payloads and results are not intentionally retained by the current API after the response. Production request-body logging must remain disabled.
- **AI interpretation requests:** Zhishi does not intentionally persist the minimised request or generated text. DeepSeek may retain and process API inputs and outputs under its own terms and privacy materials; those materials do not state a fixed API-input deletion period. Users should not include names, contact details, medical records, or other sensitive information in the optional question.
- **On-device saved charts:** retained until the user clears the saved chart or removes the relevant application storage.
- **Security logs:** the production target is no more than 30 days unless a longer period is necessary to investigate an incident or meet a legal obligation.
- **Support records:** the production retention period must be set before support channels launch.

We will delete or anonymise personal data when it is no longer needed for the stated purpose, subject to legal retention obligations.

## 9. International Transfers

Render hosts the current Zhishi API in Frankfurt. DeepSeek states that it directly collects, processes, and stores personal data in the People's Republic of China. Before offering the AI interpretation feature publicly to EU, EEA, or UK users, Zhishi must complete an appropriate transfer mechanism, such as Standard Contractual Clauses or the applicable UK transfer mechanism, a transfer-impact assessment, the required processor terms, and supplementary safeguards where necessary. The production Notice will identify the final transfer locations and how to request a copy of applicable safeguards.

## 10. Your Privacy Rights

Depending on location and applicable law, users may have rights to:

- know whether and how personal data is processed;
- access, correct, or delete personal data;
- restrict or object to processing;
- receive portable data;
- withdraw consent without affecting earlier lawful processing;
- opt out of sale, sharing, targeted advertising, or qualifying automated decision-making;
- appeal a denied U.S. state privacy request where applicable; and
- complain to a data-protection authority, state attorney general, or other regulator.

Zhishi will not discriminate against a user for exercising a privacy right. Production requests will be accepted at **[privacy request URL/email]**, with identity verification limited to what is reasonably necessary.

## 11. California Notice at Collection

This section applies if Zhishi is subject to the California Consumer Privacy Act.

| Category collected | Primary purpose | Sold or shared for cross-context behavioural advertising | Retention |
| --- | --- | --- | --- |
| Identifiers and technical data | Security, service delivery, support | No in the current MVP | Target: up to 30 days for security logs |
| Geolocation-related birth input | Chart calculation and time-zone resolution | No | Transient API processing; on-device until cleared if saved |
| User-provided personal characteristics and content | Chart calculation and reflection features | No | Transient or on-device as described above |
| Inferences generated from submitted data | Display the requested cultural interpretation | No | Transient or on-device as described above |

If sale, sharing, targeted advertising, financial incentives, or a use of sensitive personal information outside permitted purposes is introduced, Zhishi will add the required opt-out or limit controls before that processing begins and will honour legally recognised opt-out preference signals where applicable.

## 12. Automated Processing and AI Transparency

The chart engine uses deterministic rules to calculate traditional calendar outputs. These outputs do not make legal or similarly significant decisions about a user.

DeepSeek generates the optional cultural interpretation. The product labels that content as AI-generated and separately identifies the deterministic facts cited by each section. Users are not told that a deterministic calculation is AI-generated, and AI-written interpretation is not presented as a deterministic engine fact. The feature does not make legal or similarly significant decisions about a user.

## 13. Children

Zhishi is intended for adults aged 18 or older and is not directed to children. We do not knowingly collect personal data from children under 13 in the United States or below the applicable digital-consent age in Europe. If we learn that such data was collected without the required authorisation, we will stop processing and delete it as required. A neutral age screen and deletion workflow must be implemented before public account registration launches.

## 14. Security

We use technical and organisational safeguards proportionate to the nature of the data. The production baseline includes encryption in transit, access controls, least-privilege administration, dependency and vulnerability management, backups appropriate to the feature, an incident-response process, and secure deletion. No method of storage or transmission is completely secure.

## 15. Changes

We will publish the updated date and provide additional notice for material changes. Where consent is the legal basis, we will request new consent before materially different processing begins.

## 16. Contact and Complaints

- Privacy requests: **[privacy email or request portal]**
- Postal address: **[Company Legal Name and registered address]**
- EU representative: **[if required]**
- UK representative: **[if required]**
EU and EEA users may complain to the data-protection authority in their country. UK users may complain to the Information Commissioner’s Office. U.S. users may contact the regulator identified by applicable state law.
