<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">
         A Product Manager by trade<br>
         My own best product by choice.
        </h1>

        <div class="hero-subtitle">
          <p>Product Manager | Designer</p>
          <p>Blockchain Explorer | Idealist</p>
          <p class="spacer">&nbsp;</p>
          <p class="last-line">Currently Based On Dublin & China</p>
        </div>
      </div>
    </section>

    <!-- Works -->
    <section id="selected-works" class="selected-works">
      <div class="selected-works-header">
        <h2>Selected Works</h2>
        <p class="section-desc">I believe that truly great products emerge at the intersection of empathy and strategy.</p>
      </div>
      <div class="work-grid">
        <router-link to="/work/w1" class="work-item">
          <div class="content-wrapper">
            <div class="title-group">
              <div class="header-wrapper">
                <div class="work-icon">
                  <img src="@/assets/icons/enterprise.svg" alt="Enterprise" />
                </div>
                <h3>Enterprise Workspace SaaS</h3>
              </div>
            </div>
            <p>For managing personnel, attendance, and access control in modern workplaces.</p>
          </div>
        </router-link>
        <router-link to="/work/w2" class="work-item">
          <div class="content-wrapper">
            <div class="title-group">
              <div class="header-wrapper">
                <div class="work-icon">
                  <img src="@/assets/icons/security.svg" alt="Security" />
                </div>
                <h3>Security Management System</h3>
              </div>
            </div>
            <p>To address challenges in offline environments.</p>
          </div>
        </router-link>
        <router-link to="/work/w3" class="work-item">
          <div class="content-wrapper">
            <div class="title-group">
              <div class="header-wrapper">
                <div class="work-icon">
                  <img src="@/assets/icons/iot.svg" alt="IoT" />
                </div>
                <h3>IoT Platform</h3>
              </div>
            </div>
            <p>To address the needs of device management, data collection, and remote monitoring.</p>
          </div>
        </router-link>
        <router-link to="/work/w4" class="work-item">
          <div class="content-wrapper">
            <div class="title-group">
              <div class="header-wrapper">
                <div class="work-icon">
                  <img src="@/assets/icons/analytics.svg" alt="Analytics" />
                </div>
                <h3>Operation Analytics Platform</h3>
              </div>
            </div>
            <p>To provide insights into product performance, sales trends, and customer feedback.</p>
          </div>
        </router-link>
      </div>
    </section>


  <!-- Essay -->
   <section id="research" class="essay-projects">
      <div class="essay-header">
        <h2>Essay & Projects</h2>
        <p class="section-desc">Doing a HCI Master's at UCD taught me how to truly design with a user-centered approach.</p>
      </div>
      <div class="essay-content">
        <a href="/pdfs/essay1.pdf" target="_blank" class="essay-frame">
          <div class="image-container">
            <img src="@/assets/images/essay1.png" alt="Essay 1" />
          </div>
          <div class="text-content">
            <h3>How might we develop a secure system of alerting doctors of an urgent lab result?</h3>
          </div>
        </a>
        
        <a href="/pdfs/essay2.pdf" target="_blank" class="essay-frame">
          <div class="image-container">
            <img src="@/assets/images/essay2.png" alt="Essay 2" />
          </div>
          <div class="text-content">
            <h3>Building Legal Understanding: A User Centered Approach to Accessible Legal Aid In Ireland</h3>
          </div>
        </a>
      </div>
    </section>

<!-- Time -->
<section id="interest" class="time-spent">
  <div class="time-header">
    <h2>Time I Spent</h2>
    <p class="section-desc">As a product lead's interest, I love to share</p>
  </div>
  <div class="interest-list">
    <!-- <router-link to="/interest/blockchain" class="interest-item"> -->
    <div class="interest-item">
      <h3>BlockChain Explorer</h3>
      <div class="progress-bar"></div>
      <ul>
        <li>NFT</li>
        <li>DeFi</li>
        <li>Meme</li>
      </ul>
    </div>
    <!-- </router-link> -->

    <!-- <router-link to="/interest/photography" class="interest-item"> -->
    <div class="interest-item">
      <h3>Amateur Photographer</h3>
      <div class="progress-bar"></div>
      <ul>
        <li>Cat</li>
        <li>Life</li>
        <li>Travel</li>
      </ul>
    </div>
    <!-- </router-link> -->

    <!-- <router-link to="/interest/construction" class="interest-item"> -->
    <div class="interest-item">
      <h3>Construction Hobbyist</h3>
      <div class="progress-bar"></div>
      <ul>
        <li>Lego</li>
        <li>Puzzle</li>
        <li>Crochet</li>
      </ul>
    </div>
    <!-- </router-link> -->

    <!-- <router-link to="/interest/productivity" class="interest-item"> -->
    <div class="interest-item">
      <h3>Productivity App Enthusiast</h3>
      <div class="progress-bar"></div>
      <ul>
        <li>Notion</li>
        <li>Obsidian</li>
        <li>Figma</li>
      </ul>
    </div>
    <!-- </router-link> -->
  </div>
</section>
    <!-- CTA -->
    <footer class="footer">
  <div class="footer-content">
    <div class="footer-left">
      <h2>Shall<br/>We</h2>
    </div>
    <div class="footer-right">
      <p>I am always open to connect with people in tech, learn more about product management, and discuss navigating this rewarding career path.</p>
      <div class="button-container">
      <a href="mailto:wyf024326@gmail.com" class="email-btn">
        Email Me
      </a>
      <a href="https://www.linkedin.com/in/fayewang0602/" class="linkedin-btn">
        Linked Me
      </a>
      </div>
    </div>
  </div>
  <!-- 注释掉 footer-links 部分
  <div class="footer-links">
    <nav>
      <router-link to="/work">Work</router-link>
      <router-link to="/research">Research</router-link>
      <router-link to="/interest">Interest</router-link>
    </nav>
  </div>
  -->
  <div class="copyright">
    © Copyright 2025 @Yanfei Wang. Bridges The Tech And Business (31/01/2025 Updated)
  </div>
</footer>
  </div>
</template>

<script>
export default {
  name: 'HomeView'
}
</script>

<style lang="scss" scoped>
.home {
  max-width: 100%;
  margin: 0;
  padding: 0;
  background-color: #FFF7F2;

  // 内容容器样式
  .content-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 300px;
  }

  section {
    margin-bottom: 80px;
  }


// Hero section - 背景全宽，内容有限制
.hero {
  background-color: #AA99AA; /* 背景颜色 */
  color: 000000;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px; /* Frame 高度 */
  padding: 60px 20px;
  box-sizing: border-box;
  min-height: 400px; /* 最小高度 */
  height: auto; /* 自适应内容高度 */
  

  @media (max-width: 768px) {
    padding: 20px; /* 小屏减少内边距 */
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    align-items: center; /* 默认居中对齐 */
    text-align: center;
    max-width: 1280px;
    width: 100%; /* 自适应宽度 */
    padding: 0 20px; /* 内边距 */
    box-sizing: border-box;
    gap: 20px;

    @media (max-width: 768px) {
      align-items: flex-start; /* 小屏左对齐 */
      text-align: left;
      padding: 0; /* 移除小屏多余内边距 */
    }
  }

  .hero-title {
    font-family: 'Open Sans', sans-serif;
    font-weight: 800; /* ExtraBold */
    font-size: 64px;
    line-height: 1.2;
    margin: 0;
    max-width: 100%; /* 确保宽度不会超出容器 */
    word-wrap: break-word; /* 强制换行 */
    word-break: break-word; /* 防止溢出 */

    @media (max-width: 1200px) {
      font-size: 48px; /* 中屏字体缩小 */
    }

    @media (max-width: 768px) {
      font-size: 36px; /* 中屏字体缩小 */
    }

    @media (max-width: 480px) {
      font-size: 28px; /* 小屏字体缩小 */
    }
  }

  .hero-subtitle {
    display: flex;
    flex-direction: column;
    gap: 8px; /* 每行间距 */

    p{font-family: 'Open Sans', sans-serif;
    font-weight: 600; /* SemiBold */
    font-size: 16px;
    line-height: 1;
    margin: 0;
    }

    .spacer {
      height: 2px; /* 空行高度 */
      display: block; /* 确保空行占据独立的块 */
      margin: 0;
      padding: 0;
    }

    .last-line{
      font-weight: 300;
      font-size:16px;
      margin-top:8px;
    }
    

    @media (max-width: 768px) {
      font-size: 14px; /* 小屏字体缩小 */
    }
  }
}

// 通用样式
.section-header {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px; // 确保有适当的内边距
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center; // 默认居中

  h2 {
    font-family: 'Open Sans', sans-serif;
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .section-desc {
    font-family: 'Open Sans', sans-serif;
    font-size: 16px;
    font-weight: 400;
    margin: 0;
  }

  @media (max-width: 768px) {
    align-items: flex-start; // 小屏幕左对齐
    text-align: left;
    padding: 0 10px; // 小屏幕下的内边距
  }
}

//Essay

.essay-projects {
  .essay-header {
    @extend .section-header;
    margin-bottom: 20px
  }

  .essay-content {
    padding: 0 20px; // 确保与其他部分一致
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
  }

  .essay-frame {
    display: flex;
    gap: 100px;
    align-items: center;
    background-color: #FFF7F2;
    border-radius: 15px;
    padding: 20px;
    width: 100%;
    max-width: 800px;
    box-shadow: none;
    border: none;
    text-decoration: none; /* 移除下划线 */
    color: inherit; /* 保持原有文字颜色 */
    transition: all 0.3s ease; /* 添加过渡效果 */
    cursor: pointer; /* 显示指针样式 */

    &:hover {
      transform: translateY(-2px); /* 悬浮时略微上移 */
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* 添加阴影 */
      background-color: #F9F0ED; /* 轻微改变背景色 */
    }

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  .image-container {
    flex-shrink: 0;
    width: 300px;
    height: 162px;
    display: flex;
    justify-content: center;
    align-items: center;

    img {
      width: 100%;
      height: auto;
      object-fit: cover;
    }
  }

  .text-content {
    width: 420px;
    display: flex;
    flex-direction: column;
    gap: 3px;

    h3 {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
      color: #000000;
      margin: 0;
    }

    p {
      font-size: 14px;
      font-weight: 400;
      margin: 0;
      color: #666;
    }
  }
}

//Time
  .time-spent {
  padding: 0;

  .time-header {
    @extend .section-header;
    margin-bottom: 40px; // 与 interest-list 保持 20px 的间距
  }

  .interest-list {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 20px;
    display: grid;
    grid-template-columns: repeat(4, 280px); /* 增加宽度从 240px 到 280px */
    justify-content: center;
    gap: 20px;
  }
}

.interest-item {
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  cursor: pointer;
  min-width: 0; /* 添加这行确保文字可以正常换行 */

  h3 {
    font-family: 'Open Sans', sans-serif;
    font-weight: 600;
    font-size: 20px;
    line-height: 130%;
    color: #000000;
    margin: 0;
    margin-bottom: 10px;
    white-space: nowrap; /* 防止文字换行 */
  }

  .progress-bar {
    width: 65px;
    height: 8px;
    background-color: #AA99AA;
    border-radius: 10px;
    border: 1px solid #000000;
    margin-bottom: 10px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  &:hover .progress-bar {
    width: 130px;
    background-color: #40C575;
  }

  ul {
    font-family: 'Open Sans', sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 130%;
    color: #000000;
    list-style-position: inside;
    padding: 0;
    margin: 0;

    li {
      margin-bottom: 5px;
    }
  }
}

// CTA section - 背景全宽，内容有限制
.cta {
  background-color: #AA99AA;
  padding: 60px 0;
  color: white;

  .cta-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between; // 左右对齐

    .left {
      h2 {
        font-family: 'Open Sans', sans-serif;
        font-size: 64px; // 字号为64
        font-weight: 800; // ExtraBold
        line-height: 130%; // 行高
        margin: 0;
      }
    }

    .right {
      display: flex;
      flex-direction: column;
      align-items: flex-start; // 左对齐

      p {
        font-family: 'Open Sans', sans-serif;
        font-size: 16px; // 字体大小
        font-weight: 600; // SemiBold
        line-height: 100%; // 行高
        color: #000000; // 字体颜色
        margin: 0 0 20px 0; // 与按钮的间距
        max-width: 600px;
      }

      .email-btn {
        background-color: #333333;
        color: white;
        border: none;
        border-radius: 25px;
        padding: 10px 20px;
        font-family: 'Open Sans', sans-serif;
        font-size: 16px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 0.3s ease;

        &:hover {
          background-color: #555555;
        }
      }

      .linkedin-btn {
        background-color: #333333;
        color: white;
        border: none;
        border-radius: 25px;
        padding: 10px 20px;
        font-family: 'Open Sans', sans-serif;
        font-size: 16px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 0.3s ease;

        &:hover {
          background-color: #555555;
        }
      }
    }
  }
}

  // // 标题和描述文字容器
  h2, .section-desc {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 300px;
  }

  h2 {
    font-size: 1.8em;
    margin-bottom: 10px;
  }

  .section-desc {
    color: #666;
    margin-bottom: 30px;
  }


// Selected Works 样式
.selected-works {
  .selected-works-header {
    @extend .section-header;
  }

  .work-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); // 两列布局
    gap: 40px; // 调整卡片之间的间距
    justify-content: center; // 确保卡片居中
    max-width: 800px; // 设置最大宽度
    margin: 0 auto; // 居中对齐

    @media (max-width: 768px) {
      grid-template-columns: 1fr; // 小屏幕单列布局
    }
  }

  .work-item {
    background-color: #F9F0ED;
    border: 1px solid #000000;
    border-radius: 15px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
  }

  h2, .section-desc {
    padding: 0;
    margin-bottom: 40px;
  }
}


  // // Time I Spent 样式
  // .interest-list {
  //   display: grid;
  //   grid-template-columns: repeat(4, 1fr);
  //   gap: 0;
  //   padding: 0;
  //   margin: 0;
  //   max-width: 100%;

  //   .interest-item {
  //     h3 {
  //       font-size: 1.1em;
  //       margin-bottom: 15px;
  //     }

  //     ul {
  //       list-style: none;
  //       padding: 0;

  //       li {
  //         color: #666;
  //         margin-bottom: 5px;
  //       }
  //     }
  //   }
  // }

  // CTA 区域样式
  .cta {
    margin: 0;
    background-color: #AA99AA;
    padding: 60px 0;
    border-radius: 0;

    h2 {
      font-size: 2.5em;
      margin-bottom: 20px;
    }

    p {
      max-width: 600px;
      margin: 0 auto 30px;
    }

    .email-btn {
      background-color: #333;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1.1em;

      &:hover {
        background-color: #444;
      }
    }

    .linkedin-btn {
      background-color: #333;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1.1em;

      &:hover {
        background-color: #444;
      }
    }
  }

  // 为了保持内容不会太靠近屏幕边缘，可以给具体的内容添加内边距
  .hero-content,
  .work-grid,
  .essay-grid,
  .interest-list,
  .cta-content,
  .section-desc {
    max-width: 100%;
    margin: 0;
    padding: 40px 200px;
  }

  // 标题和描述文字的容器
  h2, .section-desc {
    padding: 0 200px;
  }

  // Selected Works 标题部分样式
  .selected-works-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 20px;
    max-width: 1280px;
    width: 90%;
    gap: 10px;
    
   @media (max-width: 768px) {
    text-align: left; /* 小屏幕文字靠左对齐 */
    align-items: flex-start;
    padding: 0 10px; /* 减少边距 */
    }

    #width: 1280px;
    #height: 60px;
    #margin: 0 auto;
    #padding: 0 200px;
    #box-sizing: border-box;
    #display: flex;
    #flex-direction: column;
    #align-items: center;
    #gap: 10px;

    h2 {
      font-family: 'Open Sans', sans-serif;
      font-size: 24px;
      font-weight: 700;  // bold
      margin: 0;
      padding: 0;
    }

    .section-desc {
      font-family: 'Open Sans', sans-serif;
      font-size: 16px;
      font-weight: 400;  // regular
      margin: 0;
      padding: 0;
      color: #000000;
    }
  }
}

.work-item {
  width: 400px;
  height: 200px;
  padding: 20px;
  box-sizing: border-box;
  background-color: #F9F0ED;
  border: 1px solid #000000;
  border-radius: 15px;
  text-decoration: none;
  color: inherit;/* 居中显示 */


  &:hover {
    text-decoration: none;
  }

  .content-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;  // Frame1 和正文之间的间距
    justify-content: center;

    .title-group {
      .header-wrapper {
        display: flex;
        gap: 10px;
        align-items: center;

        .work-icon {
          width: 50px;
          height: 50px;
          flex-shrink: 0;

          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }

        h3 {
          font-family: 'Open Sans', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #000000;
          margin: 0;
          position: relative;
          line-height: 1.2;

          &::after {
            content: '';
            position: absolute;
            left: 0;
            bottom: -16px;
            width: 65px;
            height: 8px;
            background-color: #AA99AA;
            border: 1px solid #000000;
            border-radius: 10px;
            transition: all 0.3s ease;
          }
        }
      }
    }

    p {
      font-family: 'Open Sans', sans-serif;
      font-size: 16px;
      font-weight: 400;
      color: #383233;
      margin: 0;
      line-height: 1.5;
    }
  }

  &:hover {
    .title-group .header-wrapper h3::after {
      width: 105px;
      background-color: #40C575;
    }
  }
}

.footer {
  color: white;
  background-color: #AA99AA; /* 紫色背景 */
}

.footer-content {
  display: flex;
  align-items: center;
  max-width: 100%;
  margin: 0 auto;
  background-color: #AA99AA;
  padding: 40px 20px;
  justify-content: center;
  margin-left: -50px;
}

.footer-left h2 {
  font-family: 'Open Sans', sans-serif;
  font-size: 64px;
  font-weight: 800;
  margin: 0;
  color: #222;
}

.footer-right {
  
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 20px; /* 文字和按钮之间的间距 */
}

.footer-right p {
  font-family: 'Open Sans', sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 130%;
  margin: 0;
  color: #000000;
}

.email-btn {
  background-color: #333333;
  color: white;
  border: none;
  border-radius: 25px;
  padding: 12px 24px; /* 调整按钮内边距 */
  font-family: 'Open Sans', sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  align-self: flex-start; /* 按钮左对齐 */
  display: flex;
  align-items: center;
  gap: 8px; /* 图标和文字之间的间距 */
    text-decoration: none; /* 如果使用 a 标签，移除下划线 */
}

.linkedin-btn {
  background-color: #333333;
  color: white;
  border: none;
  border-radius: 25px;
  padding: 12px 24px; /* 调整按钮内边距 */
  font-family: 'Open Sans', sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  align-self: flex-start; /* 按钮左对齐 */
  display: flex;
  align-items: center;
  gap: 8px; /* 图标和文字之间的间距 */
    text-decoration: none; /* 如果使用 a 标签，移除下划线 */
}

.email-btn:hover {
  background-color: #555555;
}

.linkedin-btn:hover {
  background-color: #555555;
}

.button-container {
  display: flex;
  gap: 10px; /* 按钮之间的间距 */
}


.button-container {
  display: flex;
  gap: 10px; /* 按钮之间的间距 */
}

.email-btn, .linkedin-btn {
  display: inline-block;
  padding: 10px 15px;
  text-decoration: none;
  border-radius: 5px;
  background-color: #383233;
  color: white;
}


.copyright {
  background-color: #333333;
  color: white;
  text-align: center;
  padding: 20px;
  font-family: 'Open Sans', sans-serif;
  font-size: 14px;
  font-weight: 400;
  display: flex;
  justify-content: center;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.1); /* 添加顶部分割线 */
}
</style>