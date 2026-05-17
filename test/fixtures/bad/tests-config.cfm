<!--- Triggers: CFML-TEST-002, CFML-CFG-002 --->
<cffunction name="calculateTax" returntype="numeric">
    <cfargument name="amount" type="numeric">
    <cfreturn arguments.amount * 0.2>
</cffunction>
<cfset apiBase = "http://localhost:8080/api">
<cfset logPath = "C:\inetpub\wwwroot\logs">
