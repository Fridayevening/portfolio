<template>
  <div class="work-view">
    <h1>Enterprise Workspace SaaS</h1>
    <p class="intro">
      The Enterprise Workspace SaaS platform offers an integrated solution for managing personnel, attendance, and access control in modern workplaces. Designed for flexibility and scalability, the platform simplifies complex workflows, enhances security, and drives efficiency through intuitive interfaces and advanced analytics.
    </p>
  </div>

  <div class="Problem">
    <section>
      <h2>What's the problem?</h2>
      <p >Companies need one system to manage people, attendance, and visitors.<br></p>
      <p >Old systems can't share data between door access and attendance.<br></p>
      <p >Companies need a simple platform for daily work and security.<br></p>
      <p >Small companies can't use current systems easily.</p>
    </section>
  </div>

  <div class="Solution">
    <section>
      <h2>What is our Minimum Viable Product (MVP)?</h2>
      <p>I chose these main features for our first version:<br>
      <span class="bold-text">Basic Personnel Management System</span><br>
      Department configuration + Personnel information management  + Efficient batch import/export capabilities.<br>
      <span class="bold-text">Core Attendance Management Functions</span><br>
      Streamlined device onboarding and configuration + Remote door control  + Essential device parameter management.<br>
      <span class="bold-text">Device Management Features</span><br>
      Flexible timetable configuration + Comprehensive shift management + Intuitive attendance scheduling.</p>
    </section>
  </div>

  <div class="Business">

    <section>
      <h2>What is our Business Model going to be?</h2>
      <p class="block">Starter:Basic features for small teams and startups.<br>
      Professional:Advanced features for growing companies.<br>
      Enterprise:Full customization and premium support.</p>
      <p>Additional revenue streams:<br></p>
      <p class="block">Hardware device sales and integration.<br>
      API access and custom development.<br>
      Professional services and support.</p>
    </section>
  </div>

  <div class="Product">

    <section>
      <h2>What do we finally build?</h2>
      <div class="modules">
        <div class="module">
          <h3>Personnel Management Module</h3>
          <ul>
            <li>Flexible department structure management.</li>
            <li>Comprehensive personnel information handling.</li>
            <li>Efficient batch operations.</li>
            <li>Customizable field configuration.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Device Management Module</h3>
          <ul>
            <li>Seamless device integration.</li>
            <li>Comprehensive remote control capabilities.</li>
            <li>Advanced parameter customization.</li>
            <li>Real-time status monitoring.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Access Control Module</h3>
          <ul>
            <li>Dynamic permission management.</li>
            <li>Group-based access control.</li>
            <li>Multi-person verification.</li>
            <li>Advanced security features like interlock and anti-tailgating.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Attendance Management Module</h3>
          <ul>
            <li>Flexible timetable management.</li>
            <li>Advanced shift handling.</li>
            <li>Smart scheduling system.</li>
            <li>Detailed reporting.</li>
            <li>Mobile-first check-in solution.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Visitor Management Module</h3>
          <ul>
            <li>Smart appointment management.</li>
            <li>Real-time status tracking.</li>
            <li>Comprehensive record keeping.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Meeting Room Management Module</h3>
          <ul>
            <li>Meeting room booking and management.</li>
            <li>Device association with meeting spaces.</li>
            <li>Participant tracking & Usage analytics.</li>
          </ul>
        </div>
         <div class="module">
          <h3>OA System Module</h3>
          <ul>
            <li>Customizable approval workflows.</li>
            <li>Multi-level authorization processes.</li>
            <li>Document management.</li>
            <li>Task tracking.</li>
          </ul>
        </div>
         <div class="module">
          <h3>System Architecture</h3>
          <ul>
            <li>Multi-tenant cloud architecture.</li>
            <li>Real-time data synchronization.</li>
            <li>Open API framework.</li>
            <li>Multiple deployment options..</li>
          </ul>
        </div>
        <!-- Add more modules as needed -->
      </div>
    </section>
  </div>

  <div class="Final Product">

    <section>
      <h2>The Final Product:</h2>
      <p><span class="bold-text">An integrated enterprise workspace platform consisting of three core products:</span></p>
      <ul>
        <li>UstarCloud: A scalable web platform offering tiered features from basic to premium, with customizable interfaces and dedicated domains for each enterprise client.</li>
        <li>UstarMobile: A mobile app for employees featuring basic attendance functions for free users, with advanced features like geo-location check-in and custom workflows available through enterprise subscriptions.</li>
        <li>UstarAccess: A specialized mobile app for security management, providing tiered access from basic door control to advanced security features, customizable based on enterprise requirements.</li>
      </ul>
      <p><span class="bold-text">All three products share:</span></p>
      <ul>
        <li>Seamless data synchronization.</li>
        <li>Multi-level permission management.</li>
        <li>Comprehensive analytics and reporting.</li>
        <li>Flexible deployment options.</li>
        <li>Complete API ecosystem for third-party integration.</li>
      </ul>
    </section>
  </div>

  <div class="Outcomes">

    <section>
      <h2>Outcomes:</h2>
      <p>After leading the development of this enterprise workspace platform through multiple iterations, I created a powerful solution that is now:</p>
      <ul>
        <li>Managing over 850,000 employees across 5,381 organizations.</li>
        <li>Processing daily operations through 7,610 connected devices.</li>
        <li>Achieving an average of 158 employees per client organization.</li>
        <li>Operating with high efficiency - each device serving 112 users on average.</li>
      </ul>
      <div class="highlight-box">
        <p>
          I started this project by addressing fundamental workspace management needs, which evolved into a comprehensive platform that has transformed how thousands of organizations handle their daily operations, from basic attendance tracking to sophisticated security management.
This impact demonstrates how focusing on solving real user problems can lead to meaningful improvements in enterprise efficiency and security.
        </p>
      </div>
    </section>
  </div>

</template>

<script>
export default {
  name: 'Work1View'
}
</script>

<style scoped>
.work-view,.Problem, .Solution, .Business, .Product, .Final, .Outcomes {
  background-color: #FFF7F2; 
}
.work-view {
  max-width: auto;
  margin: 60px 0  auto;
  padding: 30px 200px 0 200px;
  font-family: 'Open Sans', sans-serif;
  text-align: center;
  background-color: #FFF7F2; 
}

h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 20px;
  
}

.intro {
  font-size: 18px;
}

.Problem, .Solution, .Business, .Product, .Final, .Outcomes {
  max-width: auto;
  padding: 0 200px;
  text-align: left;
  font-family: 'Open Sans', sans-serif;
}

.Outcomes {
  padding: 0px 200px 50px 200px;
}

h2 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 10px;
  font-family: 'Open Sans', sans-serif;
  padding: 30px 0 10px 0;
}

.modules {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-family: 'Open Sans', sans-serif;
}

.module {
  flex: 1 1 calc(50% - 20px);
  background-color: #FFF7F2;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ccc;

  font-family: 'Open Sans', sans-serif;
}

p {
  font-size: 16px;
  font-weight: 400;
  margin-bottom: 0px;
  font-family: 'Open Sans', sans-serif;
}

ul {
  list-style-type: disc;
  padding-left: 20px;
  font-family: 'Open Sans', sans-serif;
}

li {
  margin-bottom: 0px;
  font-family: 'Open Sans', sans-serif;
}

.bold-text {
  font-weight: 600;
  margin: 5px 0; /* 设置上下5px的间距 */
  display: inline-block; /* 使其成为块级元素 */
}

.block {
  margin: 5px 0; /* 设置上下5px的间距 */
  display: inline-block; /* 使其成为块级元素 */
}

.highlight-box {
  background-color: #d4edda; /* 绿色背景 */
  border-left: 2px solid #40C575; /* 蓝色边框 */
  padding: 15px;
  margin-top: 20px;
  border-radius: 5px;
  font-family: 'Open Sans', sans-serif;
}
</style>