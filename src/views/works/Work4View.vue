<template>
  <div class="work-view">
    <h1>Operations Analytics Platform</h1>
    <p class="intro">
    It is an internal data analytics solution designed to provide comprehensive insights into hardware device performance, sales trends, and customer feedback. It empowers teams to make data-driven decisions through advanced visualization, predictive analytics, and automated reporting tools.
    </p>
  </div>

  <div class="Problem">
    <section>
      <h2>What's the problem?</h2>
      <p >Difficulties in managing dispersed devices: Traditional methods struggle to effectively monitor and manage thousands of devices.<br></p>
      <p >Limited visibility into product performance: Teams struggle to assess hardware quality and customer satisfaction due to insufficient analytics tools.<br></p>
      <p >Inefficient reporting: Generating custom reports is time-consuming and lacks consistency across departments.<br></p>
    </section>
  </div>

  <div class="Solution">
    <section>
      <h2>What is our Minimum Viable Product (MVP)?</h2>
      <p>I chose these main features for our first version:<br>
      <span class="bold-text">Dynamic dashboards</span><br>
      Batch registration and configuration of devices with cross-platform data synchronization.<br>
      <span class="bold-text">Data collection and visualization</span><br>
      Real-time device status, data trends, and anomaly alerts.<br>
      <span class="bold-text">Permission control and user management</span><br>
      Flexible user grouping and permission allocation to accommodate multi-role needs.</p>
    </section>
  </div>

  <div class="Product">

    <section>
      <h2>What do we finally build?</h2>
      <div class="modules">
        <div class="module">
          <h3>Sales and Inventory Management Module</h3>
          <ul>
            <li>Sales trend prediction for setting accurate sales targets.</li>
            <li>Inventory demand forecasting to optimize stock levels and reduce waste.</li>
            <li>Real-time insights into shipment volumes, accessory usage, and performance trends.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Anomaly Detection Module</h3>
          <ul>
            <li>Real-time alerts for hardware quality issues like spikes in repair rates or complaints.</li>
            <li>Detection of regional anomalies such as high return rates.</li>
            <li>Data integrity checks to ensure error-free data synchronization.</li>
          </ul>
        </div>
        <div class="module">
          <h3>User Behavior Analytics Module</h3>
          <ul>
            <li>Analysis of customer usage patterns across industries and regions for product improvement.</li>
            <li>Identification of high-risk customers to enable proactive support.</li>
            <li>Insights to enhance customer satisfaction and reduce churn.</li>
          </ul>
        </div>
        <div class="module">
          <h3>Reporting and Insights Module</h3>
          <ul>
            <li>Interactive dashboards with real-time visibility into key metrics.</li>
            <li>Customizable reports for tailored insights, exportable in PDF or Excel.</li>
            <li>Predictive analytics combining sales and customer data for smarter decisions.</li>
          </ul>
        </div>
        <!-- Add more modules as needed -->
      </div>
    </section>
  </div>

  <div class="Final Product">

    <section>
      <h2>The Final Product:</h2>
      <p><span class="bold-text">An all-in-one operations analytics solution tailored for internal use:</span></p>
      <ul>
        <li>Enhanced decision-making: Provides actionable insights into sales performance, product quality, and customer satisfaction.</li>
        <li>Streamlined reporting: Simplifies report generation for key stakeholders.</li>
        <li>Cross-departmental alignment: Facilitates collaboration through shared data access and unified dashboards.</li>
      </ul>
    </section>
  </div>

  <div class="Outcomes">

    <section>
      <h2>Outcomes:</h2>
      <p>The platform delivered significant benefits across the organization:</p>
      <ul>
        <li>Improved operational efficiency: Reduced manual reporting time by 50%.</li>
        <li>Better product quality insights: Enabled root cause analysis for repair and complaint data, improving defect response times by 30%.</li>
        <li>Enhanced sales strategy: Provided regional and time-based performance trends, driving more targeted sales campaigns.</li>
        <li>Actionable reporting: Over 80% of teams reported faster decision-making enabled by custom report functionalities.</li>
      </ul>
      <div class="highlight-box">
        <p>
          The Operations Analytics Platform represents a significant step forward in leveraging data to drive operational improvements. By centralizing critical metrics and providing intuitive tools, the platform has empowered teams to work more effectively and make better decisions, setting a new standard for data-driven operations.
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
  margin: 60px 0 auto;
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