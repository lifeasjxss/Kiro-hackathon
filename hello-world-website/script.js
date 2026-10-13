const greetings = [
  "Hello, World!",
  "Hi there!",
  "Hey, nice to see you!",
  "Greetings, friend!",
  "Howdy!",
];

const heading = document.querySelector("h1");
const button = document.getElementById("greetBtn");

button.addEventListener("click", () => {
  const next = greetings[Math.floor(Math.random() * greetings.length)];
  heading.textContent = next;
});
