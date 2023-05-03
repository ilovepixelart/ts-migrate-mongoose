import { Schema, model, models } from 'mongoose'

interface IUser {
  firstName: string
  lastName?: string
}

const UserSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  }
})

export default models.User ?? model<IUser>('user', UserSchema)
