<?xml version="1.0"?>
<serviceModel xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" name="{{serviceName}}" generation="1" functional="0" release="0" Id="93ef26d8-86db-4402-b9b3-d2801a8cdada" dslVersion="1.2.0.0" xmlns="http://schemas.microsoft.com/dsltools/RDSM">
  <groups>
    <group name="{{serviceName}}Group" generation="1" functional="0" release="0">
      <componentports>
        {{#workerRoles}}
        <inPort name="{{name}}:HttpIn" protocol="tcp">
          <inToChannel>
            <lBChannelMoniker name="/{{serviceName}}/{{serviceName}}Group/LB:{{name}}:HttpIn" />
          </inToChannel>
        </inPort>
        {{/workerRoles}}
      </componentports>
      <settings>
        {{#workerRoles}}
        <aCS name="{{name}}Instances" defaultValue="[1,1,1]">
          <maps>
            <mapMoniker name="/{{serviceName}}/{{serviceName}}Group/Map{{name}}Instances" />
          </maps>
        </aCS>
        {{/workerRoles}}
      </settings>
      <channels>
        {{#workerRoles}}
        <lBChannel name="LB:{{name}}:HttpIn">
          <toPorts>
            <inPortMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}/HttpIn" />
          </toPorts>
        </lBChannel>
        {{/workerRoles}}
      </channels>
      <maps>
        {{#workerRoles}}
        <map name="Map{{name}}Instances" kind="Identity">
          <setting>
            <sCSPolicyIDMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}Instances" />
          </setting>
        </map>
        {{/workerRoles}}
      </maps>
      <components>
        {{#workerRoles}}
        <groupHascomponents>
          <role name="{{name}}" generation="1" functional="0" release="0" software="{{name}}_522c569b-a62a-4a58-b66b-fb489fe7a673.cssx" entryPoint="base\x64\WaHostBootstrapper.exe" parameters="base\x64\WaWorkerHost.exe" memIndex="1792" hostingEnvironment="consoleroleadmin" hostingEnvironmentVersion="2">
            <componentports>
              <inPort name="HttpIn" protocol="tcp" portRanges="80" />
            </componentports>
            <settings>
              <aCS name="__ModelData" defaultValue="&lt;m role=&quot;{{name}}&quot; xmlns=&quot;urn:azure:m:v1&quot;&gt;&lt;r name=&quot;{{name}}&quot;&gt;&lt;e name=&quot;HttpIn&quot; /&gt;&lt;/r&gt;&lt;/m&gt;" />
            </settings>
            <resourcereferences>
              <resourceReference name="DiagnosticStore" defaultAmount="[4096,4096,4096]" defaultSticky="true" kind="Directory" />
              <resourceReference name="EventStore" defaultAmount="[1000,1000,1000]" defaultSticky="false" kind="LogStore" />
            </resourcereferences>
          </role>
          <sCSPolicy>
            <sCSPolicyIDMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}Instances" />
            <sCSPolicyUpdateDomainMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}UpgradeDomains" />
            <sCSPolicyFaultDomainMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}FaultDomains" />
          </sCSPolicy>
        </groupHascomponents>
        {{/workerRoles}}
      </components>
      {{#workerRoles}}
      <sCSPolicy>
        <sCSPolicyUpdateDomain name="{{name}}UpgradeDomains" defaultPolicy="[5,5,5]" />
        <sCSPolicyFaultDomain name="{{name}}FaultDomains" defaultPolicy="[2,2,2]" />
        <sCSPolicyID name="{{name}}Instances" defaultPolicy="[1,1,1]" />
      </sCSPolicy>
      {{/workerRoles}}
    </group>
  </groups>
  <implements>
    <implementation Id="737464b1-fa52-41a1-8805-83cd4d0480d6" ref="Microsoft.RedDog.Contract\ServiceContract\{{serviceName}}Contract@ServiceDefinition">
      <interfacereferences>
        {{#workerRoles}}
        <interfaceReference Id="69482b45-1c28-4737-9429-898cc3010dce" ref="Microsoft.RedDog.Contract\Interface\{{name}}:HttpIn@ServiceDefinition">
          <inPort>
            <inPortMoniker name="/{{serviceName}}/{{serviceName}}Group/{{name}}:HttpIn" />
          </inPort>
        </interfaceReference>
        {{/workerRoles}}
      </interfacereferences>
    </implementation>
  </implements>
</serviceModel>