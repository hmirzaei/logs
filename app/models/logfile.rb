class Logfile < ActiveRecord::Base
  mount_uploader :attachment, AttachmentUploader # Tells rails to use this uploader for this model.
  validates :time, presence: true # Make sure the owner's time is present.
end

