  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


    const data = res.data || {};
      const token = data.token ?? null;
      let profile = data.user ?? null;
      if (!profile) {
        // check for any extra fields returned that could be user info
        const copy = { ...data };
        delete copy.token;
        delete copy.user;
        if (Object.keys(copy).length) profile = copy;
      }

      if (!profile && token) {
        try {
          profile = await fetchProfile(token);
        } catch (fetchErr) {
          console.warn("Could not fetch profile after signup token:", fetchErr);
          profile = null;
        }
      }

      if (!profile) profile = { name, email };
      persistAuth(profile, token);
      if (typeof onSignup === "function") {
        try {
          onSignup(profile, rememberMe, token);
        } catch (callErr) {
          console.warn("onSignup threw:", callErr);
          navigate("/");
        }
      } else {
        navigate("/");
      }
      setPassword("");
    }
catch (err) {
      console.error("Signup error:", err?.response || err);
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (err.response?.data?.message) {
        setErrors({ api: err.response.data.message });
      } else {
        setErrors({ api: err.message || "An unexpected error occurred" });
      }
    }

 
                <>
                  <svg className={signupStyles.spinner} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2-647z"></path>
                  </svg>
                  Creating account...
                </>
    
