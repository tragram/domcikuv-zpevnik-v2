type PendingComponentProps = {
  title: string;
  text: string;
};

function PendingComponent({ title, text }: PendingComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full outline-primary outline-2 rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">{title}</h1>
        <p className="text-700">{text}</p>
      </div>
    </div>
  );
}

export default PendingComponent;
