<!--- Triggers: CFML-SEC-007, CFML-CFG-001 --->
<cfcomponent>
    <cfset this.name = "LegacyApp">
    <cfset this.datasource = "appDSN">
    <cfset this.sessionManagement = true>
    <cfset this.setClientCookies = false>

    <cffunction name="onRequestStart" returntype="boolean">
        <cfargument name="targetPage" type="string">
        <cfset requestCacheKey = "global-" & arguments.targetPage>
        <cfreturn true>
    </cffunction>
</cfcomponent>
