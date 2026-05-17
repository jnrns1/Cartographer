<!--- Triggers: CFML-DEP-001, CFML-DEP-002, CFML-DEP-003, CFML-DEP-004, CFML-DEP-005 --->
<cfwddx action="cfml2wddx" input="#data#" output="x">
<cfreport template="invoice.cfr" format="PDF">
<cfregistry action="get" branch="App\Settings" entry="Path" variable="p">
<cfcollection action="create" collection="docs" path="idx">
<cfsearch name="r" collection="docs" criteria="term">
<cfindex collection="docs" action="refresh" type="file" key="k">
<cfset label = iif(score GT 0, de("pass"), de("fail"))>
