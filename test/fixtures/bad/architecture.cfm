<!--- Triggers: CFML-ARCH-002, CFML-ARCH-003, CFML-ARCH-004, CFML-AI-003 --->
<cfoutput>
  <cfquery name="list" datasource="app">SELECT name FROM customer</cfquery>
  <table><tr><td>#list.name#</td></tr></table>
</cfoutput>
<cf_auditLog action="view">
<cfmodule template="widgets/box.cfm" title="Box">
<cfset server.appCache = structNew()>
<cfthread action="run" name="warmup">noop</cfthread>
