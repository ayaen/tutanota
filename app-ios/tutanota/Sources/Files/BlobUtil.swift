//
//  Created by Tutao GmbH on 9/16/21.
//

import Foundation

/**
 Functions for working with larger files from Blob Store
 */
@objc
class BlobUtil : NSObject {

  
  func getTempFileUri(fileName: String) -> String {
    let encDirPath = try! FileUtils.getEncryptedFolder()
    return (encDirPath as NSString).appendingPathComponent(fileName)
  }
  

  func hashFile(fileUri: String, callback: @escaping (String?, Error?) -> Void) {
    DispatchQueue.global(qos: .userInitiated).async {
      let url = URL(fileURLWithPath: fileUri)
      let data: Data
      do {
        data = try Data(contentsOf: url)
      } catch {
        callback(nil, error)
        return
      }
      let hash = TUTCrypto.sha256(data)
      callback(hash.base64EncodedString(), nil)
    }
  }
  
  func joinFiles(fileName: String, filePathsToJoin: [String], completion: @escaping ResponseCallback<String>) {
    DispatchQueue.global(qos: .userInitiated).async {
      let decryptedDir = try! FileUtils.getDecryptedFolder() as NSString
      let outputFilePath = decryptedDir.appendingPathComponent(fileName)
      let outputFileUri = URL(fileURLWithPath: outputFilePath)
      
      let createdFile = FileManager.default.createFile(atPath: outputFilePath, contents: nil, attributes: nil)
      guard createdFile else {
        completion(.failure(TUTErrorFactory.createError("Could not create file \(outputFileUri)")))
        return
      }
      let outputFileHandle = try! FileHandle(forWritingTo: outputFileUri)
      
      for inputFile in filePathsToJoin {
        let fileUri = URL(fileURLWithPath: inputFile)
        do {
          let fileContent = try Data(contentsOf: fileUri)
          outputFileHandle.write(fileContent)
        } catch {
          completion(.failure( error))
          return
        }
      }
      completion(.success(outputFilePath))
    }
  }
  
  @objc
  func split(fileUri: String, maxBlobSize: Int, completion: @escaping (Array<[String: String]>?, Error?) -> Void) {
    DispatchQueue.global(qos: .userInitiated).async {
      let fileHandle = FileHandle(forReadingAtPath: fileUri)!
      var result = [[String: String]]()
      while true {
        let chunk = fileHandle.readData(ofLength: maxBlobSize)
        
        if chunk.isEmpty {
          // End of file
          break
        }
        
        let hash = TUTCrypto.sha256(chunk)
        let outputFileName = "\(TUTEncodingConverter.bytes(toHex: hash.subdata(in: 0..<6))).blob"
        let encryptedDir = try! FileUtils.getEncryptedFolder() as NSString
        let outputPath = encryptedDir.appendingPathComponent(outputFileName)
        let outputUrl = URL(fileURLWithPath: outputPath)
        do {
          try chunk.write(to: outputUrl)
        } catch {
          completion(nil, error)
          return
        }
        result.append([
          "blobId": hash.subdata(in: 0..<6).base64EncodedString(),
          "uri": outputPath
        ])
      }
      completion(result, nil)
    }
  }
  
  @objc
  func uploadFile(
      atPath filePath: String,
      toUrl urlString: String,
      withHeaders headers: [String : String],
      completion: @escaping ([String : Any]?, Error?) -> Void
  ) {
    DispatchQueue.global(qos: .default).async(execute: {
      let url = URL(string: urlString)!
      let request = NSMutableURLRequest(url: url)
      request.httpMethod = "PUT"
      request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
      request.allHTTPHeaderFields = headers

      // Ephemeral sessions do not store any data to disk; all caches, credential stores, and so on are kept in RAM.
      let configuration = URLSessionConfiguration.ephemeral
      let session = URLSession(configuration: configuration)
      // let fileUrl = FileUtils.url(fromPath: filePath)
      let fileURL = URL(fileURLWithPath: filePath)
      let task = session.uploadTask(with: request as URLRequest, fromFile: fileURL) { data, response, error in
        if (error != nil) {
          completion(nil, error)
          return
        }
        let httpResponse = response as! HTTPURLResponse
        let suspensionTime = httpResponse.allHeaderFields["Retry-After"] ?? httpResponse.allHeaderFields["Suspension-Time"]
        let base64Response = data?.base64EncodedString()
        // We have to put NSNull because Objecive-C cannot have nil in dictionary
        let responseDict: [String: Any] = [
          "statusCode": httpResponse.statusCode,
          "errorId": httpResponse.allHeaderFields["Error-Id"] ?? NSNull(),
          "precondition": httpResponse.allHeaderFields["Precondition"] ?? NSNull(),
          "suspensionTime": suspensionTime ?? NSNull(),
          "responseBody": base64Response ?? NSNull()
        ]
        completion(responseDict, nil)
      }
      task.resume()
    })
  }
}
