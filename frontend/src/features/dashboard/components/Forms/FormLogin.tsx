// FormLogin.jsx
import Modal from "@/features/modal/modal";

const FormLogin = ({ isLoginOpen, closeLogin }) => {
  return (
    <Modal isOpen={isLoginOpen} onClose={closeLogin}>
      <h2 className="text-xl font-bold mb-4">Login</h2>
      <form>
        <input
          type="text"
          placeholder="Username"
          className="w-full mb-3 p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
        >
          Submit
        </button>
      </form>
    </Modal>
  );
};

export default FormLogin;
