const RootLayout = ({ children }) => {
  return (
    <div className="App w-full h-full">
      {/* <Link to="/">Home</Link>
      <Link to="/about">About</Link> */}

      {children}
    </div>
  );
};

export default RootLayout;
