export const profile = {
  name: "Aravind R",
  title: "Full Stack Web Developer",
  location: "Bengaluru, India",
  phone: "+91 8867236457",
  email: "aravind.r194@gmail.com",
  linkedin: "https://linkedin.com/in/aravindr194",
  linkedinLabel: "linkedin.com/in/aravindr194",
  summary:
    "Full stack engineer who ships web applications and real-time 3D experiences. Comfortable across Angular, Java/Spring, and PlayCanvas—from product UIs and APIs to game logic and AI.",
};

export const GAME_URL = "https://playcanv.as/p/M9NVSxyb/";

export type JobPoint = {
  text: string;
  href?: string;
  hrefLabel?: string;
};

export const experience = [
  {
    company: "Skellam AI",
    role: "Software Development Engineer",
    period: "Mar 2023 — Present",
    location: "Bengaluru",
    logo: "/images/logos/skellam.png",
    logoAlt: "Skellam AI",
    points: [
      {
        text: "Developed and integrated a customer loyalty program feature for a web application using Angular, HTML, CSS, SCSS, TypeScript, JavaScript, Java, Spring Boot, MySQL, and PostgreSQL, improving user engagement, retention, and overall customer satisfaction.",
      },
      {
        text: "Collaborated with design teams and stakeholders to translate business and user requirements into intuitive user experiences, following agile methodologies and participating in design reviews and user testing.",
      },
      {
        text: "Contributed to the continuous improvement of application architecture and performance, enhancing system reliability, scalability, and end-user experience.",
      },
    ] satisfies JobPoint[],
  },
  {
    company: "Tata Consultancy Services",
    role: "Assistant System Engineer",
    period: "Jan 2021 — Mar 2023",
    location: "Bengaluru",
    logo: "/images/logos/tcs.png",
    logoAlt: "Tata Consultancy Services",
    points: [
      {
        text: "Developed and delivered project features as a collaborative member of an agile Scrum team, ensuring the timely completion of tasks in a project life cycle management web application.",
      },
      {
        text: "Designed, developed, and enhanced user interfaces in close collaboration with clients and design teams, resulting in intuitive and visually appealing user experiences., and batch jobs.",
      },
      {
        text: "Implemented backend APIs for diverse features, including Mailers, Reports, and Batch jobs, enhancing the application's functionality and facilitating seamless data exchange.",
      },
      {
        text: "Proactively identified and resolved over 90 performance bottlenecks and bugs, optimizing the application's user experience and ensuring high quality standards through unit tests, code reviews, and adherence to industry best practices.",
      },
    ] satisfies JobPoint[],
  },
  {
    company: "Someshwara Software Pvt Ltd",
    role: "Game Developer Intern",
    period: "Jul 2019 — Oct 2019",
    location: "Bengaluru",
    logo: "/images/logos/someshwara.png",
    logoAlt: "Someshwara Software",
    points: [
      {
        text: "Designed and developed a 3D Cube tic-tac-toe game using Playcanvas WebGL game engine.",
      },
      {
        text: "Developed 3D assets, user Interfaces, and game logic used in the game.",
      },
      {
        text: "Developed game-playing AI using the Mini-max algorithm.",
      },
      {
        text: "Collaborated with other team members for game design and review.",
      },
      {
        text: "Try the game out on your mobile:",
        href: GAME_URL,
        hrefLabel: GAME_URL.replace("https://", ""),
      },
    ] satisfies JobPoint[],
  },
];

export const education = {
  degree: "Bachelor of Engineering, Computer Science",
  school: "Visvesvaraya Technological University",
  period: "2016 — 2020",
  location: "Bengaluru",
  gpa: "7.4 / 10",
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
