import githubIconSvg from "./github_icon.svg?raw";

const GithubIcon = () => (
  <span
    style={{ display: "contents" }}
    dangerouslySetInnerHTML={{ __html: githubIconSvg }}
  />
);

export default GithubIcon;
