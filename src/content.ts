export const profile = {
  name: "Aravind R",
  title: "Full Stack Web Developer",
  location: "Bengaluru, India",
  email: "aravind.r194@gmail.com",
  linkedin: "https://linkedin.com/in/aravindr194",
  linkedinLabel: "linkedin.com/in/aravindr194",
  summary:
    "Full stack developer with 5+ years building and scaling production web applications, from customer-facing UIs to backend systems handling real load.",
  about: [
    "I'm a full stack developer based in Bengaluru with 5+ years turning product requirements into working software. Most of that time I've spent moving between Angular on the frontend and Java/Spring Boot on the backend — but the part I actually enjoy most is the systems thinking in between: figuring out how something should scale, fail gracefully, and stay maintainable once real users and real data hit it, not just how it should look in a demo. Outside of product work, I have a long-running soft spot for real-time 3D — this site itself is partly an excuse to keep exploring that space, built with Three.js as much for the fun of it as for the portfolio.",
    "When I'm not at a keyboard, I'm probably on a badminton or football court, at the gym, or in a pool — I like activities that force me to actually be present. On the other end of that, I'm also very much a PC gamer, and I spend time on the creative side too: playing guitar, drawing, dabbling in design, and working through a long watchlist of movies and anime. Traveling ties it all together — it's usually where I end up doing the least screen time and the most everything else.",
  ],
};

export const GAME_URL = "https://playcanv.as/p/M9NVSxyb/";

export type JobPoint = {
  text: string;
  href?: string;
  hrefLabel?: string;
};

export type Role = {
  title: string;
  period: string;
  points: JobPoint[];
};

export type Experience = {
  company: string;
  location: string;
  logo: string;
  logoAlt: string;
  roles: Role[];
};

export const experience: Experience[] = [
  {
    company: "Skellam AI",
    location: "Bengaluru, India",
    logo: "images/logos/skellam.png",
    logoAlt: "Skellam AI",
    roles: [
      {
        title: "Software Development Engineer 2",
        period: "Mar 2024 — Present",
        points: [
          {
            text: "Promoted to SDE 2 within one year in recognition of full-stack ownership and delivery consistent with a software engineer role from day one.",
          },
          {
            text: "Built an AWS Lambda function that generates up to 5 million unique coupons per configurable pool into PostgreSQL, using batched, rate-limited writes to avoid overloading database CPU and connections.",
          },
          {
            text: "Leveraged AWS S3 for UI asset and application config storage consumed by Spring Boot and Lambda, and provisioned EC2 instances from prebuilt templates, attaching them to load balancers across multiple AWS regions.",
          },
          {
            text: "Monitored production application health via AWS CloudWatch, analyzing logs to detect anomalies and resolve customer-reported issues and bugs.",
          },
        ],
      },
      {
        title: "UI Developer",
        period: "Mar 2023 — Mar 2024",
        points: [
          {
            text: "Developed and integrated a customer loyalty program feature for a production web application using Angular, TypeScript, JavaScript, HTML, CSS, and SCSS on the frontend and Java, Spring Boot, MySQL, and PostgreSQL on the backend, improving user engagement and customer retention.",
          },
          {
            text: "Built backend APIs alongside frontend components to support new features, functioning as a full-stack contributor despite the UI Developer title.",
          },
          {
            text: "Collaborated with design teams and stakeholders to translate business and user requirements into intuitive user experiences, following Agile methodologies and participating in design reviews and user acceptance testing.",
          },
        ],
      },
    ],
  },
  {
    company: "Tata Consultancy Services",
    location: "Bengaluru, India",
    logo: "images/logos/tcs.png",
    logoAlt: "Tata Consultancy Services",
    roles: [
      {
        title: "Assistant System Engineer",
        period: "Jan 2021 — Mar 2023",
        points: [
          {
            text: "Developed and delivered project features as a member of an Agile Scrum team, consistently meeting sprint deadlines on a project lifecycle management web application.",
          },
          {
            text: "Built backend APIs for core application features including mailers, reports, and batch jobs, enabling seamless data exchange between system modules.",
          },
          {
            text: "Identified and resolved over 90 performance bottlenecks and bugs, improving application stability and user experience while maintaining code quality through unit testing and peer code reviews.",
          },
        ],
      },
    ],
  },
  {
    company: "Someshwara Software Pvt Ltd",
    location: "Bengaluru, India",
    logo: "images/logos/someshwara.png",
    logoAlt: "Someshwara Software",
    roles: [
      {
        title: "Game Developer Intern",
        period: "Jul 2019 — Oct 2019",
        points: [
          {
            text: "Designed and developed a 3D cube-based tic-tac-toe game using the PlayCanvas WebGL game engine.",
          },
          {
            text: "Built 3D assets, user interfaces, and core game logic for the application.",
          },
          {
            text: "Implemented a game-playing AI opponent using the Minimax algorithm.",
          },
          {
            text: "Collaborated with team members on game design, feature development, and code review.",
          },
          {
            text: "Try the game out on your mobile:",
            href: GAME_URL,
            hrefLabel: GAME_URL.replace("https://", ""),
          },
        ],
      },
    ],
  },
];

export const education = {
  degree: "Bachelor of Engineering, Computer Science",
  school: "Visvesvaraya Technological University",
  period: "2016 — 2020",
  location: "Bengaluru",
};

export const skills = {
  "Front end": [
    "HTML",
    "CSS",
    "SCSS",
    "Less",
    "JavaScript",
    "TypeScript",
    "AngularJS",
    "Angular",
    "React",
    "Node",
  ],
  "Back end": ["Java", "Spring Framework", "Hibernate", "JPA"],
  Database: ["PostgreSQL", "MySQL"],
  Other: ["Git", "Python", "C", "C++", "PlayCanvas"],
};

export const featured = {
  title: "3D Cube Tic-Tac-Toe",
  tags: ["PlayCanvas", "WebGL", "Game AI"],
  description:
    "A three-dimensional tic-tac-toe experience built in PlayCanvas: custom 3D assets and UI, game rules, and a minimax opponent.",
  href: GAME_URL,
};
