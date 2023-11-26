import UserModel from '../model/User.model.js'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import ENV from '../config.js'
import otpGenerator from 'otp-generator';

/** middleware for verify user */
export async function verifyUser(req, res, next) {
    try {
        const { username } = req.method == "GET" ? req.query : req.body;

        // check the user existence
        let exist = await UserModel.findOne({ username });
        if (!exist) return res.status(404).send({ error: "Can't find User!" });
        next();
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: "Authentication Error" });
    }
}

export async function addMoney(req,res){
    try {
        
        const {username} = req.params;
        const user = await UserModel.findOne({ username });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const currentBalance = user.balance || 0;
        const amountToAdd = parseFloat(req.body.addMoney);
        user.balance = currentBalance + amountToAdd;
        await user.save();
        res.json({ balance: user.balance });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
}

export async function transferMoney(req, res) {
    try {
        const { username } = req.params;
        const { account, amount } = req.body;

        const user1 = await UserModel.findOne({ account });
        if (!user1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user2 = await UserModel.findOne({ username });
        if (!user2) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance1 = user1.balance || 0;
        const amountToAdd = parseInt(amount, 10);
        user1.balance = currentBalance1 + amountToAdd;

        const currentBalance2 = user2.balance || 0;
        user2.balance = currentBalance2 - amountToAdd;

        await Promise.all([user1.save(), user2.save()]);

        res.json({ 
            senderBalance: user1.balance,
            receiverBalance: user2.balance
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}



export async function pinMatch(req, res) {
    
    try {
        const { pin } = req.body;
        const { username } = req.params;

        // Find the user in the database
        const user = await UserModel.findOne({ username });

        if (!user) {
            return res.status(404).send({ error: "User not found" });
        }

        // Compare the provided (plaintext) PIN with the stored (plaintext) PIN
        if (pin !== user.pin) {
            return res.status(401).send({ error: "Invalid PIN" });
        }

        // If PIN is correct, send the balance
        return res.status(200).send({ message: "Balance generated", balance: user.balance });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
}
/** POST: http://localhost:8080/api/register 
 * @param : {
  "username" : "example123",
  "password" : "admin123",
  "email": "example@gmail.com",
  "firstName" : "bill",
  "lastName": "william",
  "mobile": 8009860560,
  "address" : "Apt. 556, Kulas Light, Gwenborough",
  "profile": ""
}
*/

export async function register(req, res) {
    try {
        const { username, password, profile, email,pin, accountNumber } = req.body;

        // Check the existing username
        const existUsername = await UserModel.findOne({ username });

        // Check for an existing email
        const existEmail = await UserModel.findOne({ email });

        if (existUsername) {
            res.status(400).send({ error: "Please use a unique username" });
        } else if (existEmail) {
            res.status(400).send({ error: "Please use a unique email" });
        } else {
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                const accountNumber1 = Math.floor(1000000000 + Math.random() * 9000000000);

                const user = new UserModel({
                    username,
                    password: hashedPassword,
                    profile: profile || '',
                    email,
                    pin,
                    accountNumber: accountNumber1
                });

                console.log(user);

                // Save the user and handle the result
                try {
                    const result = await user.save();
                    res.status(201).send({ msg: "User registered successfully" });
                    console.log("login")
                } catch (error) {
                    console.error(error);
                    res.status(500).send({ error });
                }
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
}


/** POST: http://localhost:8080/api/login 
 * @param: {
  "username" : "example123",
  "password" : "admin123"
}
*/
export async function login(req, res) {
    try {
        const { username, password } = req.body;

        UserModel.findOne({ username })
            .then(user => {
                bcrypt.compare(password, user.password)
                    .then(passwordCheck => {

                        if (!passwordCheck) return res.status(400).send({ error: "Don't have Password" });

                        // create jwt token
                        const token = jwt.sign({
                            userId: user._id,
                            username: user.username
                        }, ENV.JWT_SECRET, { expiresIn: "24h" });

                        return res.status(200).send({
                            msg: "Login Successful...!",
                            username: user.username,
                            token
                        });

                    })
                    .catch(error => {
                        return res.status(400).send({ error: "Password does not Match" })
                    })
            })
            .catch(error => {
                return res.status(404).send({ error: "Username not Found" });
            })

    } catch (error) {
        return res.status(500).send({ error });
    }
}

/** GET: http://localhost:8080/api/user/example123 */
export async function getUser(req, res) {
    try {
        const { username } = req.params;
        console.log("hii")
        if (!username) return res.status(501).send({ error: "Invalid Username" });

        const user = await UserModel.findOne({ username });

        if (!user) return res.status(501).send({ error: "Couldn't Find the User" });

        /** remove password from user */
        const { password, ...rest } = user.toJSON();
        return res.status(201).send(rest);

    } catch (error) {
        console.error(error);
        return res.status(404).send({ error: "Cannot Find User Data" });
    }
}


/** PUT: http://localhost:8080/api/updateuser 
 * @param: {
  "header" : "<token>"
}
body: {
    firstName: '',
    address : '',
    profile : ''
}
*/
export async function updateUser(req, res) {
    try {
        const { userId } = req.user;

        if (userId) {
            const body = req.body;

            // Update the data using async/await
            const updateResult = await UserModel.updateOne({ _id: userId }, body);

            console.log(updateResult);
            if (updateResult.modifiedCount > 0) {
                return res.status(201).send({ msg: "Record Updated...!" });
            } else {
                return res.status(404).send({ error: "No matching record found or no changes made." });
            }

        } else {
            return res.status(401).send({ error: "User Not Found...!" });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).send({ error });
    }
}


/** GET: http://localhost:8080/api/generateOTP */
export async function generateOTP(req, res) {
    try {
        req.app.locals.OTP = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false })
        res.status(201).send({ code: req.app.locals.OTP })
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
}

/** GET: http://localhost:8080/api/verifyOTP */
export async function verifyOTP(req, res) {
    try {
        const { code } = req.query;
        if (parseInt(req.app.locals.OTP) === parseInt(code)) {
            req.app.locals.OTP = null; 
            req.app.locals.resetSession = true;
            return res.status(201).send({ msg: 'Verify Successfully!' })
        }
        return res.status(400).send({ error: "Invalid OTP" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
}

// successfully redirect user when OTP is valid
/** GET: http://localhost:8080/api/createResetSession */
export async function createResetSession(req, res) {
    try {
        if (req.app.locals.resetSession) {
            return res.status(201).send({ flag: req.app.locals.resetSession })
        }
        return res.status(440).send({ error: "Session expired!" })
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
}

// update the password when we have a valid session
/** PUT: http://localhost:8080/api/resetPassword */
export async function resetPassword(req, res) {
    try {
        if (!req.app.locals.resetSession) return res.status(440).send({ error: "Session expired!" });

        const { username, password } = req.body;

        UserModel.findOne({ username })
            .then(user => {
                bcrypt.hash(password, 10)
                    .then(hashedPassword => {
                        UserModel.updateOne({ username: user.username },
                            { password: hashedPassword }, function (err, data) {
                                if (err) throw err;
                                req.app.locals.resetSession = false; // reset session
                                return res.status(201).send({ msg: "Record Updated...!" })
                            });
                    })
                    .catch(e => {
                        console.error(e);
                        return res.status(500).send({
                            error: "Unable to hash password"
                        })
                    })
            })
            .catch(error => {
                console.error(error);
                return res.status(404).send({ error: "Username not Found" });
            })

    } catch (error) {
        console.error(error);
        return res.status(500).send({ error });
    }
}
