<!--- Triggers: CFML-MOD-003, CFML-MOD-005 --->
<cfquery name="s" datasource="shopDSN">SELECT id FROM product WHERE name LIKE '%abc%'</cfquery>
<cfhttp url="https://api.openai.com/v1/chat/completions" method="post"></cfhttp>
