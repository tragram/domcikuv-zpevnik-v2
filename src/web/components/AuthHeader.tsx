export const AuthHeader: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex flex-col items-center gap-4 mb-4">
      <a href="#" className="flex flex-col items-center gap-2 font-medium">
        <div className="flex h-12 w-12 items-center justify-center rounded-md">
          <img src="/icons/favicon.svg" alt="Logo" className="h-12 w-12" />
        </div>
        <span className="sr-only">Domčíkův Zpěvník</span>
      </a>
      <h1 className="text-lg md:text-xl font-bold">{text}</h1>
    </div>
  );
};
