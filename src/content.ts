export const profile = {
  name: "Aravind R",
  title: "Full Stack Web Developer",
  location: "Bengaluru, India",
  phone: "+91 8867236457",
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

export const experience = [
  {
    company: "Skellam AI",
    role: "Software Development Engineer",
    period: "Mar 2023 — Present",
    location: "Bengaluru",
    logo: "images/logos/skellam.png",
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
    logo: "images/logos/tcs.png",
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
    logo: "images/logos/someshwara.png",
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
