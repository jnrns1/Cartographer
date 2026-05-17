<!--- Triggers: CFML-SEC-001, CFML-SEC-002, CFML-SEC-003, CFML-SEC-004, CFML-SEC-005, CFML-SEC-006 --->
<cfquery name="getUser" datasource="app">
    SELECT * FROM users WHERE id = #url.userId# AND status = '#form.status#'
</cfquery>

<cfset summary = evaluate("getUser.recordCount & ' rows'")>
<cfset fallback = de("literal")>

<cfinclude template="#url.page#.cfm">

<cffile action="upload" filefield="doc" destination="/srv/uploads" nameconflict="makeunique">

<cfset password = "S3cr3tP@ssw0rd!">

<cfheader name="X-Forward" value="#url.next#">

<cfoutput>Done.</cfoutput>
