<!--- Triggers: CFML-UI-001, CFML-ARCH-002 --->
<cfoutput>
  <cfquery name="users" datasource="shopDSN">SELECT name FROM users</cfquery>
  <cfgrid name="ug" format="html"></cfgrid>
  <table><tr><td>#users.name#</td></tr></table>
</cfoutput>
