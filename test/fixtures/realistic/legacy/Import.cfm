<!--- Triggers: CFML-DEP-001, CFML-DEP-004, CFML-SEC-002 --->
<cfwddx action="cfml2wddx" input="#data#" output="x">
<cfsearch name="r" collection="docs" criteria="term">
<cfset z = evaluate("1 + 1")>
