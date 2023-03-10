const { google } = require('googleapis')
const OAuth2 = google.auth.OAuth2

const OAuth2Client = new OAuth2()
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { generateAccessToken, generateRefreshToken, generateVerifyCode } = require('../utils/auth')
const { transporter } = require('../config/nodemailer')
const userService = require('../services/user.service')

const authController = {
    loginWithGoogle: async(req, res) => {
        try {
            const { accessToken } = req.body
            OAuth2Client.setCredentials({
                access_token: accessToken,
              });
            const oAuth2 = google.oauth2({
                auth: OAuth2Client,
                version: "v2",
            })
            const { data } = await oAuth2.userinfo.get()

            if (data) {
                const  { verified_email, email, name, picture, id } = data
                if (verified_email) {
                    const user = await userService.getByServiceId(id)
                    
                    if (user) {
                        const { fullName, email, avatar, phoneNumber, role, _id } = user
                        const token = generateAccessToken({ userId: _id, role })
                        const refreshToken = generateRefreshToken(_id)
                        res.cookie('refreshToken', refreshToken, {
                            httpOnly: true,
                            secure: false,
                            maxAge: 1000 * 60 * 60 * 24 * 7,
                        })
                        return res.status(200).json({
                            token,
                            user: { fullName, email, avatar, phoneNumber, userId: _id, role }
                        })
                    } else {
                        const newUser = await userService.create({
                            email, fullName: name, 
                            avatar: { url: picture }, 
                            service: "Google", serviceId: id,
                            status: 1,
                        })
                        const token = generateAccessToken({ userId: newUser?._id, role: 0 })
                        const refreshToken = generateRefreshToken({ userId: newUser?._id, role: 0 })
                        res.cookie('refreshToken', refreshToken, {
                            httpOnly: true,
                            secure: false,
                            maxAge: 1000 * 60 * 60 * 24 * 7,
                        })
                        return res.status(200).json({
                            token,
                            user: newUser
                        })
                    }
                }
              
            } 

            return res.status(500).json({
                message: 'Error',
                error: 1,
            })
            
        } catch (error) {
            console.log(error)
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    loginWithFacebook: async(req, res) => {
        try {
            const { email, name, avatar, id } = req.body
            const user = await userService.getByServiceId(id)
            if (user) {
                const { fullName, email, avatar, role, _id } = user
                const token = generateAccessToken({ userId: _id, role })
                const refreshToken = generateRefreshToken(_id)
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    maxAge: 1000 * 60 * 60 * 24 * 7,
                })
                return res.status(200).json({
                    token,
                    user: { fullName, email, avatar, userId: _id, role }
                })
            } else {
                const newUser = await userService.create({
                    email, fullName: name, 
                    avatar: { url: avatar }, 
                    service: "Facebook", serviceId: id, 
                    status: 1
                })
                const token = generateAccessToken({ userId: newUser?._id, role: 0 })
                const refreshToken = generateRefreshToken({ userId: newUser?._id, role: 0 })
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    maxAge: 1000 * 60 * 60 * 24 * 7,
                })
                return res.status(200).json({
                    token,
                    user: newUser
                })
            }
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    register: async(req, res) => {
        try {
            const { email, fullName, password } = req.body

            const checkEmail = await userService.getByEmail(email)
            if (checkEmail)  return res.status(400).json({ message: 'Email ???? t???n t???i!', error: 1,})
            
            const hashPassword = await bcrypt.hash(password, 10)

            const result = await userService.register({email, fullName, password: hashPassword})

            const code = generateVerifyCode({email})
            const host = req.get('origin')
            const link = `${host}/services/user/verify?active_code=${code}`
            const resultSendMail = await transporter.sendMail({
                from: '"BookStore" <project.php.nhncomputer@gmail.com>',
                to: email,
                subject: `[BookStore] Ch??c m???ng b???n ????ng k?? th??nh c??ng!`,
                html: ` <h3>Xin ch??o ${fullName},</h3>
                        <h3>B???n v???a ti???n h??nh ????ng k?? t??i kho???n t???i BookStore!</h3>
                        <p>Ch??c m???ng b???n tr??? th??nh th??nh vi??n BookStore.</p>
                        <p>Username : ${email}</p>
                        <a href="${link}">Nh???n v??o ????y ????? k??ch ho???t</a>`
            })
            const { password : pw, ...data } = result
            res.status(201).json({
                message: 'success',
                error: 0,
                data: data
            })
            
        } catch (error) {
            console.log(error)
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    sendVerificationEmail: async(req, res) => {
        try {
            const { email } = req.params

            const user = await userService.getByEmailRegister(email)
            if (!user) return res.status(400).json({status: "error", error: "User kh??ng t???n t???i!"})

            const code = generateVerifyCode({email})
            const host = req.get('origin')
            const link = `${host}/services/user/verify?active_code=${code}`
            const resultSendMail = await transporter.sendMail({
                from: '"BookStore" <project.php.nhncomputer@gmail.com>',
                to: email,
                subject: `[BookStore] Ch??c m???ng b???n ????ng k?? th??nh c??ng!`,
                html: ` <h3>Xin ch??o ${user.fullName},</h3>
                        <h3>B???n v???a ti???n h??nh ????ng k?? t??i kho???n t???i BookStore!</h3>
                        <p>Ch??c m???ng b???n tr??? th??nh th??nh vi??n BookStore.</p>
                        <p>Username : ${email}</p>
                        <a href="${link}">Nh???n v??o ????y ????? k??ch ho???t</a>`
            })
            res.status(200).json({
                message: 'Ok',
                resultSendMail
            })
            
        } catch (error) {
            res.status(500).json({
                status: "error",
                error: error.message
            })
        }
    },
    verifyEmail: async(req, res) => {
        try {
            const { active_code } = req.query

            const { email } = jwt.verify(active_code, process.env.JWT_ACCESS_TOKEN_SECRET);
            if (!email) res.status(400).json({error: "Token kh??ng h???p l???!"})
            const user = await userService.getByEmail(email)
            if (user) {
                await userService.updateStatus(user._id, { status: 1 })
                return res.status(200).json({message: "X??c minh t??i kho???n th??nh c??ng!!"})
                
            }
            return res.status(400).json({error: "Kh??ng t??m th???y kh??ch h??ng!!"})
        } catch (error) {
            console.log(error)
            res.status(500).json({
                status: "error",
                error: error.message
            })
        }
    },
    loginBookStore: async(req, res) => {
        try {
            const { email, password } = req.body
            const user = await userService.getByEmailRegister(email)

            if (!user) return res.status(400).json({error: 1, message: 'T??i kho???n, m???t kh???u kh??ng ????ng!'})

            const { password: passwordDB, status,  fullName, phoneNumber, avatar, role, _id } = user

            const checkPassword = await bcrypt.compare(password, passwordDB)
            if (!checkPassword) return res.status(400).json({error: 1, message: 'T??i kho???n, m???t kh???u kh??ng ????ng!'})

            if (status === 0 && role === 0)  return res.status(400).json({ error: 2, message: "T??i kho???n c???a b???n ch??a ???????c k??ch ho???t!" })
            if (status === 0 && role === 2)  return res.status(400).json({ error: 3, message: "T??i kho???n c???a b???n ???? b??? kh??a!" })
            
            const token = generateAccessToken({ userId: _id, role })
            const refreshToken = generateRefreshToken(_id)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: false,
                maxAge: 1000 * 60 * 60 * 24 * 7,
            })
            return res.status(200).json({
                token,
                user: {fullName, phoneNumber, email, avatar, userId: _id, role}
            })
            
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    handleForgotPassword: async(req, res) => {
        try {
            const { email } = req.body
            const user = await userService.getByEmailRegister(email)

            if (!user) {
                return res.status(400).json({
                    message: 'T??i kho???n kh??ng t???n t???i!',
                    error: 1,
                })
            }
            const tokenReset = generateAccessToken({userId: user._id})
            const host = req.get('origin')
            const link = `${host}/dat-lai-mat-khau/${tokenReset}`
            const resultSendMail = await transporter.sendMail({
                from: '"BOOKSTORE" <project.php.nhncomputer@gmail.com>',
                to: email,
                subject: `[BOOKSTORE] H??y ?????t l???i m???t kh???u t??i kho???n c???a b???n`,
                html: ` <h2>Xin ch??o b???n ${user.fullName},</h2>
                        <p>Ch??ng t??i bi???t r???ng b???n ???? m???t m???t kh???u BookStore c???a m??nh.</p>
                        <p>
                            Nh??ng ?????ng lo l???ng, b???n c?? th??? truy c???p link sau ????? ?????t l???i m???t kh???u c???a m??nh:
                        </p>
                        <a href="${link}"><h3>?????t l???i m???t kh???u</h3></a>
                        <p>Tr??n tr???ng,</p>
                        <p><b>BOOKSTORE</b></p>`
            })
            return res.status(200).json({
                error: 0,
                message: 'success'
            })
            
        } catch (error) {
            console.log(error)
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    handleResetPassword: async(req, res) => {
        try {
            const { token, password } = req.body

            jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, async (err, data) => {
                if (err) return res.status(400).json({error: 1, message: 'Token kh??ng h???p l???!'})
                const { userId } = data
                const user = await userService.getById(userId)
                if (user) {
                    const hashPassword = await bcrypt.hash(password, 10)
                    const result = await userService.handleResetPassword(userId, {password: hashPassword})
                    return res.status(200).json({
                        error: 0,
                        message: 'success',
                        result
                    })
                }
            })
            
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    getCurrentUser: async(req, res) => {
        try {
            const { user } = req
            const { userId } = user
            const data = await userService.getById(userId)
            return res.status(200).json({
                user: data,
                message: 'success'
            })
            
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    handleRefreshToken: async (req, res) => {
        try {
            const refreshToken = req.cookies.refreshToken
            if (!refreshToken) return res.status(401).json({message: '401 Unauthorized'})
            jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET, async (err, data) => {
                if (err) return res.status(403).json({message: '403 Forbidden'})
                const { userId } = data
                const { role } = await userService.getById(userId)
                const newToken = generateAccessToken({userId, role})
                const newRefreshToken = generateRefreshToken(userId)
                res.cookie('refreshToken', newRefreshToken, {
                    httpOnly: true,
                    secure: false,
                    maxAge: 1000 * 60 * 60 * 24 * 7,
                })
                return res.status(200).json({
                    token: newToken,
                })
            })
            
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    handleLogout: async(req, res) => {
        try {
            res.clearCookie("refreshToken")
            return res.status(200).json({message: 'Logout sucesss', error: 0})
            
        } catch (error) {
            res.status(500).json({
                message: `C?? l???i x???y ra! ${error.message}`,
                error: 1,
            })
        }
    },
    
}

module.exports = authController
