<template>
  <div class="work-view">
    <h1>IoT Platform</h1>
    <p class="intro">
      From concept to deployment, I led the development of a highly flexible Internet of Things (IoT) platform designed to address the needs of smart device management, data collection, and remote monitoring across various industries. With a modular design and powerful data processing capabilities, this platform meets customer requirements for efficient, secure, and scalable IoT systems.
    </p>
  </div>

  <div class="Problem">
    <section>
      <h2>What's the problem?</h2>
      <p >Difficulties in managing dispersed devices: Traditional methods struggle to effectively monitor and manage thousands of devices.<br></p>
      <p >Insufficient real-time data collection and response: Data delays impact operational efficiency and adaptability to dynamic changes.<br></p>
      <p >Lack of a unified system for device and user management: Managing permissions and data exchange across multiple devices and users requires a single platform.<br></p>
    </section>
  </div>

  <div class="Solution">
    <section>
      <h2>What is our Minimum Viable Product (MVP)?</h2>
      <p>I chose these main features for our first version:<br>
      <span class="bold-text">Device onboarding and management</span><br>
      Batch registration and configuration of devices with cross-platform data synchronization.<br>
      <span class="bold-text">Data collection and visualization</span><br>
      Real-time device status, data trends, and anomaly alerts.<br>
      <span class="bold-text">Permission control and user management</span><br>
      Flexible user grouping and permission allocation to accommodate multi-role needs.</p>
    </section>
  </div>

  <div class="Business">
    <section>
      <h2>What is our Business Model going to be?</h2>
      <ul>
        <li>Subscription-Based Revenue: Offering tiered subscription plans based on the number of devices, data storage requirements, and API usage.</li>
        <li>Data Processing and Analytics Services: Providing value-added services like advanced analytics, AI-powered insights, and predictive maintenance recommendations.</li>
        <li>Integration Services: Offering custom integrations with existing enterprise systems and third-party services.</li>
        <li>Hardware Sales and Support: Complementing the platform with IoT hardware devices and ongoing maintenance services.</li>
        <li>Professional Services: Enabling customers with consulting, training, and implementation support to maximize platform utility.</li>
      </ul>
    </section>
  </div>

  <div class="Product">

    <section>
      <h2>What do we finally build?</h2>
      <div class="modules">
        <div class="module">
          <h3>Device Management Module</h3>
          <ul>
            <li>Automatic device discovery and batch registration.</li>
            <li>Support for multiple protocols (MQTT, HTTP, CoAP).</li>
            <li>Flexible remote control and configuration capabilities.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Data Management Module</h3>
          <ul>
            <li>Real-time data collection and analytics.</li>
            <li>Customizable dashboards displaying key operational metrics.</li>
            <li>Anomaly detection and automated alert systems.</li>
          </ul>
        </div>
        <div class="module">
          <h3>User Permission Module</h3>
          <ul>
            <li>Tiered permission management and group access allocation.</li>
            <li>Security auditing and access log recording.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Integration and Expansion Module</h3>
          <ul>
            <li>Open APIs for third-party service integration.</li>
            <li>Support for edge computing to optimize data processing efficiency.</li>
            <li>Multi-language support and global deployment capabilities.</li>
          </ul>
        </div>
        <!-- Add more modules as needed -->
      </div>
    </section>
  </div>

  <div class="Final Product">

    <section>
      <h2>The Final Product:</h2>
      <p><span class="bold-text">A modular IoT platform offering the following features:</span></p>
      <ul>
        <li>Unified device management: Supports millions of devices with real-time status synchronization.</li>
        <li>Scalable architecture: Adaptable to enterprise growth with on-demand scalability.</li>
        <li>Powerful data analytics: Leveraging AI and big data to uncover business insights.</li>
      </ul>
      <p><span class="bold-text">The platform is composed of the following core components:</span></p>
      <ul>
        <li>IoT Hub: Centralized management for all devices and data interactions.</li>
        <li>IoT Insights: A data analytics and visualization tool to enable quick decision-making.</li>
        <li>IoT Gateway: Secure, fast device onboarding with edge computing support.</li>
      </ul>
    </section>
  </div>

  <div class="Outcomes">

    <section>
      <h2>Outcomes:</h2>
      <p>After multiple iterations and optimizations, this platform has achieved the following results:</p>
      <ul>
        <li>Serving over 1,500 enterprises across manufacturing, energy, transportation, and other industries.</li>
        <li>Supporting 10,000+ devices in real-time, processing more than 500 million data points daily.</li>
        <li>Improving device management efficiency by 40%, significantly reducing maintenance costs.</li>
        <li>Achieving an average synchronization time of under 1 minute for devices and data updates.</li>
      </ul>
      <div class="highlight-box">
        <p>
          This project began as a response to key challenges in IoT device management. The resulting platform not only enhanced operational efficiency but also provided smarter, more effective solutions for clients across diverse industries.This outcome demonstrates how user-centric product design can deliver meaningful value to customers.
        </p>
      </div>
    </section>
  </div>

</template>

<script>
export default {
  name: 'Work3View'
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

  h1{
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