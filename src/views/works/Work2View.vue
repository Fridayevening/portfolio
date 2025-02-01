<template>
  <div class="work-view">
    <h1>Offline Security Management System</h1>
    <p class="intro">
      From concept to deployment, I led the development of a scalable offline security management platform tailored to address challenges in low-connectivity environments. This solution integrates personnel management, access control, and device synchronization to streamline operations and enhance security for organizations worldwide.
    </p>
  </div>

  <div class="Problem">
    <section>
      <h2>What's the problem?</h2>
      <p >Inefficient and fragmented management: Traditional offline device management is cumbersome, with limited adaptability to dynamic demands.<br></p>
      <p >Lack of real-time security monitoring: Existing solutions fail to detect unauthorized access or manage risks effectively.<br></p>
      <p >Deployment complexity at scale: Synchronizing operations across multiple devices and users is challenging without unified tools.<br></p>
    </section>
  </div>

  <div class="Solution">
    <section>
      <h2>What is our Minimum Viable Product (MVP)?</h2>
      <p>I chose these main features for our first version:<br>
      <span class="bold-text">Core Personnel Management Features</span><br>
      Streamlined user registration through batch imports and automated role assignments.<br>
      <span class="bold-text">Device Synchronization and Configuration</span><br>
      Simplified offline device setup and permission settings, reducing deployment time.<br>
      <span class="bold-text">Access Control Capabilities</span><br>
      Time-based schedules for flexible access permissions even in offline scenarios.</p>
    </section>
  </div>

  <div class="Business">

    <section>
      <h2>What is our Business Model going to be?</h2>
      <p class="block">Starter:Offline access control for small teams with essential device and user management.<br>
      Professional:Advanced batch operations and analytics tools for growing enterprises.<br>
      Enterprise:Full customization and integration with existing security ecosystems.</p>
      <p>Additional revenue streams:<br></p>
      <p class="block">Hardware device sales and integration.<br>
      Technical support.<br>
      Professional training and consulting services.</p>
    </section>
  </div>

  <div class="Product">

    <section>
      <h2>What do we finally build?</h2>
      <div class="modules">
        <div class="module">
          <h3>Personnel Management Module</h3>
          <ul>
            <li>Batch personnel import and registration.</li>
            <li>Flexible department configurations.</li>
            <li>Role-based user access assignments.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Device Management Module</h3>
          <ul>
            <li>Remote parameter customization for offline devices.</li>
            <li>Real-time device synchronization and monitoring.</li>
            <li>Comprehensive device control capabilities.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Access Control Module</h3>
          <ul>
            <li>Time-specific access schedules and restrictions.</li>
            <li>Multi-level authentication (e.g., card, face recognition).</li>
            <li>Enhanced security features like anti-tailgating.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Logs and Monitoring Module</h3>
          <ul>
            <li>Real-time access and temperature logs.</li>
            <li>Centralized data export for audit purposes.</li>
            <li>Automated alert systems for abnormal activities.</li>
          </ul>
        </div>
        <!-- Add more modules as needed -->
      </div>
    </section>
  </div>

  <div class="Final Product">

    <section>
      <h2>The Final Product:</h2>
      <p><span class="bold-text">An integrated offline security management platform built to provide:</span></p>
      <ul>
        <li>Personnel and Device Management: Unified control for large-scale deployments.</li>
        <li>Offline Access Control: Reliable solutions tailored for limited-connectivity environments.</li>
        <li>Comprehensive Reporting: Exportable data for operational insights.</li>
      </ul>
      <p><span class="bold-text">The platform consists of three main components:</span></p>
      <ul>
        <li>UstarClient: Desktop software for device and personnel synchronization.</li>
        <li>UstarSync: A lightweight tool for real-time offline data management.</li>
        <li>UstarAccess: A feature-rich module enabling robust access permissions.</li>
      </ul>
    </section>
  </div>

  <div class="Outcomes">

    <section>
      <h2>Outcomes:</h2>
      <p>After multiple iterations and client feedback, this platform achieved:</p>
      <ul>
        <li>Managing 200,000+ users across 50+ organizations.</li>
        <li>Supporting 2,000+ connected devices in offline environments.</li>
        <li>Reducing manual configuration time by 30% with batch operation functionalities.</li>
        <li>Enabling synchronization across devices in an average of 4 minutes.</li>
      </ul>
      <div class="highlight-box">
        <p>
          I initiated this project to solve pressing challenges in offline device management. The resulting platform empowers organizations to manage access control efficiently and securely, even in low-connectivity scenarios.This success highlights how user-centered problem-solving can lead to impactful innovations in operational security and management.
        </p>
      </div>
    </section>
  </div>

</template>

<script>
export default {
  name: 'Work2View'
}
</script>

<style scoped>
.work-view,.Problem, .Solution, .Business, .Product, .Final, .Outcomes {
  background-color: #FFF7F2; 
  width: 100%;
  margin: 0;
}
.work-view {
  max-width: 100%;
  margin: 0;
  padding: 120px 0 40px;
  font-family: 'Open Sans', sans-serif;
  background-color: #FFF7F2; 

  h1 {
    max-width: 1280px;
    margin: 0 auto 20px;
    padding: 0 200px;
    font-size: 36px;
    font-weight: 700;
    text-align: center;
  
    @media (max-width: 1200px) {
      padding: 0 100px;
      font-size: 32px;
      text-align: left;
    }

    @media (max-width: 768px) {
      padding: 0 20px;
      font-size: 28px;
      text-align: left;
    }
  }

  .intro {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 200px;
    font-size: 18px;
    text-align: center;

    @media (max-width: 1200px) {
      padding: 0 100px;
      text-align: left;
    }

    @media (max-width: 768px) {
      padding: 0 20px;
      font-size: 16px;
      text-align: left;
    }
  }
  @media (max-width: 1200px) {
    padding: 100px 0 30px;
  }
  @media (max-width: 768px) {
    padding: 80px 0 20px;
  }
}

.Problem, .Solution, .Business, .Product, .Final, .Outcomes {
  width: 100%;
  margin: 0 auto;
  padding: 0 200px;
  text-align: left;
  font-family: 'Open Sans', sans-serif;

  @media (max-width: 1200px) {
    padding: 0 100px;
  }

  @media (max-width: 768px) {
    padding: 0 20px;
  }
}

.Outcomes {
  padding: 0px 200px 50px 200px;

  @media (max-width: 1200px) {
    padding: 0px 100px 40px 100px;
  }

  @media (max-width: 768px) {
    padding: 0px 20px 30px 20px;
  }
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

  @media (max-width: 1200px) {
    flex: 1 1 calc(50% - 20px);
  }
  @media (max-width: 768px) {
    flex: 1 1 100%;
  }
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