<!--- Triggers: CFML-COMPAT-LUCEE-001, CFML-COMPAT-LUCEE-002, CFML-COMPAT-LUCEE-003 --->
<cfdump var="#payload#" keys="5" expand="true">
<cfset meta = getComponentMetaData("model.User")>
<cfset emails = queryColumnData(qUsers, "email")>
