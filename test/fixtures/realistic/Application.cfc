<!--- Triggers: CFML-CFG-001, CFML-SEC-007 --->
<cfcomponent>
    <cfset this.name = "ShopApp">
    <cfset this.datasource = "shopDSN">
    <cfset this.sessionManagement = true>
    <cffunction name="onApplicationStart" returntype="boolean">
        <cfset appBootTime = now()>
        <cfreturn true>
    </cffunction>
</cfcomponent>
